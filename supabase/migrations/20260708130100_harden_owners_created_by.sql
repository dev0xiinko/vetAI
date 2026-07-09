-- Harden the owners audit trail (security-review follow-up).
--
-- The original owners policies used `with check (true)`, which let any
-- authenticated user forge `created_by` on insert or change it on update via a
-- direct PostgREST call — corrupting the "who touched this personal data" audit
-- trail (PDPA accountability). RLS is the real boundary, so pin it at the DB.
--
-- Note on deleted_at: the RBAC matrix grants all clinic roles write on owners,
-- so setting/clearing deleted_at through an UPDATE is within their granted
-- permission (soft-delete + future restore) — not an escalation, left as-is.

-- INSERT: caller must stamp themselves as creator (created_by = auth.uid()).
-- Denies: inserting a row attributed to someone else, or with a null creator.
drop policy if exists owners_insert_authenticated on public.owners;
create policy owners_insert_authenticated
  on public.owners for insert
  to authenticated
  with check (created_by = auth.uid());

-- UPDATE: pin created_by to its existing value so it can never be rewritten,
-- regardless of what the client sends. Fires before owners_set_updated_at
-- ('p' < 's'); they touch different columns.
create or replace function public.owners_pin_created_by()
returns trigger
language plpgsql
as $$
begin
  new.created_by := old.created_by;
  return new;
end;
$$;

create trigger owners_pin_created_by
  before update on public.owners
  for each row execute function public.owners_pin_created_by();
