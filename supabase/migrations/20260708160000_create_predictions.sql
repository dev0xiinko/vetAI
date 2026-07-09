-- Predictions: the audit trail for every disease-prediction run. Append-only —
-- it records what symptoms went in, what the model suggested, which model +
-- prompt version produced it, and which veterinarian ran it. This is the record
-- that keeps AI output auditable (ai-features.md). No updates, no soft-delete.
--
-- RBAC (data-and-rls.md → Disease Prediction): admin = full,
-- veterinarian = run + view history, staff = view history only.

create table public.predictions (
  id              uuid primary key default gen_random_uuid(),
  veterinarian_id uuid not null references auth.users (id) on delete cascade,
  pet_id          uuid references public.pets (id) on delete set null,
  input           jsonb not null,   -- { species, ageMonths, symptoms[], notes? } — no owner PII
  output          jsonb not null,   -- [{ condition, likelihood, rationale, recommended_next_step }]
  model           text not null,
  prompt_version  text not null,
  created_at      timestamptz not null default now()
);

create index predictions_veterinarian_id_idx on public.predictions (veterinarian_id);
create index predictions_pet_id_idx on public.predictions (pet_id);
create index predictions_created_at_idx on public.predictions (created_at desc);

-- RLS -----------------------------------------------------------------------
alter table public.predictions enable row level security;

-- SELECT: any authenticated clinic user may view prediction history.
-- Denies: anonymous.
create policy predictions_select_authenticated
  on public.predictions for select
  to authenticated
  using (true);

-- INSERT: only a veterinarian or admin may run a prediction, and must stamp
-- themselves as the runner. Denies: staff (view-only), anonymous, and
-- attributing a run to another user.
create policy predictions_insert_vet
  on public.predictions for insert
  to authenticated
  with check (
    public.auth_role() in ('admin', 'veterinarian')
    and veterinarian_id = auth.uid()
  );

-- No UPDATE policy: audit rows are immutable (updates denied for everyone).

-- DELETE (hard): admin only — the audit trail should almost never be pruned.
-- Denies: veterinarian, staff, anonymous.
create policy predictions_delete_admin
  on public.predictions for delete
  to authenticated
  using (public.auth_role() = 'admin');
