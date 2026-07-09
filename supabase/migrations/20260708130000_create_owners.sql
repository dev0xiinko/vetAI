-- Owners: pet owners / clients of the clinic. Holds personal data (name,
-- contact) — treat as PII (PH Data Privacy Act). Soft-deleted (deleted_at) so
-- client history is preserved.
--
-- RBAC (data-and-rls.md → Pet & Owner Profiles): admin = full,
-- veterinarian = read/write, staff = read/write. So every authenticated clinic
-- user may read/create/update owners; only admin may hard-delete.

create table public.owners (
  id         uuid primary key default gen_random_uuid(),
  full_name  text not null,
  email      text,
  phone      text,
  address    text,
  notes      text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index owners_created_by_idx on public.owners (created_by);
create index owners_full_name_idx on public.owners (full_name);
-- Speeds up the default "not soft-deleted" list query.
create index owners_active_idx on public.owners (created_at desc)
  where deleted_at is null;

create trigger owners_set_updated_at
  before update on public.owners
  for each row execute function public.set_updated_at();

-- RLS -----------------------------------------------------------------------
alter table public.owners enable row level security;

-- SELECT: any authenticated clinic user. `true` is intentional here — the
-- matrix grants read to all roles (not an owner-scoped restriction). Anon is
-- denied (policy is `to authenticated`). Soft-deleted rows are filtered in app
-- queries, not hidden by RLS, so admins can still recover them.
create policy owners_select_authenticated
  on public.owners for select
  to authenticated
  using (true);

-- INSERT: any authenticated clinic user may add an owner.
-- Denies: anonymous callers.
create policy owners_insert_authenticated
  on public.owners for insert
  to authenticated
  with check (true);

-- UPDATE: any authenticated clinic user may edit (including soft-delete via
-- deleted_at). Denies: anonymous callers.
create policy owners_update_authenticated
  on public.owners for update
  to authenticated
  using (true)
  with check (true);

-- DELETE (hard): admin only — prefer soft-delete in app code.
-- Denies: veterinarian, staff, anonymous.
create policy owners_delete_admin
  on public.owners for delete
  to authenticated
  using (public.auth_role() = 'admin');
