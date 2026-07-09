-- Medical records: a clinical encounter/visit for a pet. Vaccinations,
-- diagnoses, and prescriptions attach to these in later slices (not here).
-- Soft-deleted — clinical/audit value must be preserved.
--
-- RBAC (data-and-rls.md → Medical Records): admin = full,
-- veterinarian = create/update, staff = read + INTAKE fields only.
--
-- "intake fields only" is a COLUMN-level rule, which plain RLS can't express
-- (all logged-in users share the `authenticated` Postgres role). So a trigger
-- keyed on auth_role() enforces it:
--   intake  (staff-writable): visit_date, reason_for_visit, intake_weight_kg, intake_temp_c
--   clinical (vet/admin only): assessment, plan

create table public.medical_records (
  id               uuid primary key default gen_random_uuid(),
  pet_id           uuid not null references public.pets (id) on delete cascade,
  visit_date       date not null default current_date,
  reason_for_visit text,
  intake_weight_kg numeric(6, 2),
  intake_temp_c    numeric(4, 1),
  assessment       text,
  plan             text,
  created_by       uuid references auth.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);

create index medical_records_pet_id_idx on public.medical_records (pet_id);
create index medical_records_created_by_idx on public.medical_records (created_by);
create index medical_records_active_idx
  on public.medical_records (visit_date desc)
  where deleted_at is null;

create trigger medical_records_set_updated_at
  before update on public.medical_records
  for each row execute function public.set_updated_at();

-- Column-level guard: pin created_by, and block non-vets from writing clinical
-- fields. SECURITY DEFINER so auth_role() resolves regardless of RLS.
create or replace function public.medical_records_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role public.user_role := public.auth_role();
begin
  if tg_op = 'UPDATE' then
    new.created_by := old.created_by;  -- immutable audit attribution
  end if;

  if caller_role is distinct from 'admin'
     and caller_role is distinct from 'veterinarian' then
    if tg_op = 'INSERT' then
      if new.assessment is not null or new.plan is not null then
        raise exception
          'Only a veterinarian may set clinical fields (assessment, plan).'
          using errcode = '42501';
      end if;
    elsif tg_op = 'UPDATE' then
      if new.assessment is distinct from old.assessment
         or new.plan is distinct from old.plan then
        raise exception
          'Only a veterinarian may change clinical fields (assessment, plan).'
          using errcode = '42501';
      end if;
    end if;
  end if;

  return new;
end;
$$;

create trigger medical_records_guard
  before insert or update on public.medical_records
  for each row execute function public.medical_records_guard();

-- RLS -----------------------------------------------------------------------
alter table public.medical_records enable row level security;

-- SELECT: any authenticated clinic user may read records. Denies: anonymous.
create policy medical_records_select_authenticated
  on public.medical_records for select
  to authenticated
  using (true);

-- INSERT: any authenticated user may open a record (staff do intake), but must
-- stamp themselves as creator; the guard trigger blocks staff from clinical
-- fields. Denies: anonymous; attributing the row to another user.
create policy medical_records_insert_authenticated
  on public.medical_records for insert
  to authenticated
  with check (created_by = auth.uid());

-- UPDATE: any authenticated user may edit; the guard trigger restricts staff to
-- intake fields and pins created_by. Denies: anonymous.
create policy medical_records_update_authenticated
  on public.medical_records for update
  to authenticated
  using (true)
  with check (true);

-- DELETE (hard): admin only — prefer soft-delete in app code.
-- Denies: veterinarian, staff, anonymous.
create policy medical_records_delete_admin
  on public.medical_records for delete
  to authenticated
  using (public.auth_role() = 'admin');
