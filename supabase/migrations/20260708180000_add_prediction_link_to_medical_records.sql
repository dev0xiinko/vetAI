-- Link a medical record to the AI prediction run it was drafted from.
--
-- Interoperability follow-up: when a vet clicks "Draft medical record" on a
-- prediction result, the created record stores prediction_id so the audit
-- chain (symptoms -> AI suggestions -> vet-confirmed record) is queryable.
-- Nullable: most records have no prediction. on delete set null: pruning an
-- audit row (admin-only) must not delete clinical records.
--
-- RLS: unchanged — a new column inherits the table's existing policies, and
-- linking a prediction is not a clinical judgment, so the medical_records_guard
-- trigger intentionally does not gate it.

alter table public.medical_records
  add column prediction_id uuid references public.predictions (id) on delete set null;

create index medical_records_prediction_id_idx
  on public.medical_records (prediction_id);
