-- Foundation: role enum, profiles table, the auth_role() helper every other
-- policy depends on, an auto-provision trigger, and RLS.
--
-- RBAC (data-and-rls.md): role lives on profiles.role. auth_role() is the
-- SECURITY DEFINER helper policies call to read the caller's role WITHOUT
-- triggering RLS recursion on this same table.

-- 1. Role enum -------------------------------------------------------------
create type public.user_role as enum ('admin', 'veterinarian', 'staff');

-- 2. profiles table --------------------------------------------------------
-- id mirrors auth.users.id (1:1). New signups default to the least-privileged
-- role ('staff'); elevation to veterinarian/admin is an admin-only action.
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  full_name  text,
  role       public.user_role not null default 'staff',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- 3. auth_role() helper ----------------------------------------------------
-- SECURITY DEFINER so it can read profiles.role regardless of RLS. This is what
-- breaks the "policy on profiles that needs to read profiles" recursion.
create or replace function public.auth_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

revoke all on function public.auth_role() from public;
grant execute on function public.auth_role() to authenticated;

-- 4. Auto-provision a profile row on signup --------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 5. RLS -------------------------------------------------------------------
alter table public.profiles enable row level security;

-- SELECT: a user may read their own profile; admins may read all.
-- Denies: staff/vet reading other users' profiles (User Management is admin-only).
create policy profiles_select_self_or_admin
  on public.profiles for select
  to authenticated
  using (id = auth.uid() or public.auth_role() = 'admin');

-- UPDATE (self): a user may edit their own profile but NOT change their own
-- role — `with check (role = auth_role())` pins the role to its current value,
-- blocking self-escalation. Denies: any staff/vet elevating themselves.
create policy profiles_update_self
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and role = public.auth_role());

-- UPDATE (admin): admins may edit any profile, including role. Denies: non-admins.
create policy profiles_update_admin
  on public.profiles for update
  to authenticated
  using (public.auth_role() = 'admin')
  with check (public.auth_role() = 'admin');

-- INSERT: only admins insert directly (normal signups are inserted by the
-- SECURITY DEFINER trigger above, which bypasses RLS). Denies: everyone else.
create policy profiles_insert_admin
  on public.profiles for insert
  to authenticated
  with check (public.auth_role() = 'admin');

-- DELETE: admin only. Prefer soft-delete (deleted_at) in app code; hard delete
-- is an admin-only escape hatch. Denies: staff/vet.
create policy profiles_delete_admin
  on public.profiles for delete
  to authenticated
  using (public.auth_role() = 'admin');
