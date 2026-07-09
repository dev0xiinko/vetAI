-- Pets: patients of the clinic. Each belongs to an owner. Soft-deleted
-- (deleted_at) because medical history hangs off pets and must be preserved.
--
-- RBAC (data-and-rls.md → Pet & Owner Profiles): admin = full,
-- veterinarian = read/write, staff = read/write. Every authenticated clinic
-- user may read/create/update; only admin may hard-delete.
--
-- Audit trail is hardened up front (owners security-review follow-up): insert
-- forces created_by = auth.uid(), and a trigger pins it immutable on update.

create type public.pet_sex as enum ('male', 'female', 'unknown');

create table public.pets (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references public.owners (id) on delete cascade,
  name          text not null,
  species       text not null,
  breed         text,
  sex           public.pet_sex,
  date_of_birth date,
  weight_kg     numeric(6, 2),
  notes         text,
  created_by    uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

create index pets_owner_id_idx on public.pets (owner_id);
create index pets_created_by_idx on public.pets (created_by);
create index pets_active_idx on public.pets (created_at desc)
  where deleted_at is null;

create trigger pets_set_updated_at
  before update on public.pets
  for each row execute function public.set_updated_at();

-- Pin created_by immutable on update (see owners_pin_created_by rationale).
create or replace function public.pets_pin_created_by()
returns trigger
language plpgsql
as $$
begin
  new.created_by := old.created_by;
  return new;
end;
$$;

create trigger pets_pin_created_by
  before update on public.pets
  for each row execute function public.pets_pin_created_by();

-- RLS -----------------------------------------------------------------------
alter table public.pets enable row level security;

-- SELECT: any authenticated clinic user (matrix grants all roles read).
-- Denies: anonymous. Soft-deleted rows filtered in app queries.
create policy pets_select_authenticated
  on public.pets for select
  to authenticated
  using (true);

-- INSERT: any authenticated user, but must stamp themselves as creator.
-- Denies: anonymous; attributing the row to another user.
create policy pets_insert_authenticated
  on public.pets for insert
  to authenticated
  with check (created_by = auth.uid());

-- UPDATE: any authenticated user (created_by pinned by trigger).
-- Denies: anonymous.
create policy pets_update_authenticated
  on public.pets for update
  to authenticated
  using (true)
  with check (true);

-- DELETE (hard): admin only — prefer soft-delete in app code.
-- Denies: veterinarian, staff, anonymous.
create policy pets_delete_admin
  on public.pets for delete
  to authenticated
  using (public.auth_role() = 'admin');
