-- Shared trigger function: keep `updated_at` current on every UPDATE.
-- Reused by every table that has an `updated_at` column. Forward-only.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
