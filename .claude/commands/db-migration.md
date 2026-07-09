---
description: Create a reviewable Supabase SQL migration with RLS policies baked in, following project schema conventions.
argument-hint: <what the migration does, e.g. "add prescriptions table" or "add index on medical_records.pet_id">
allowed-tools: Read, Grep, Glob, Edit, Write, Bash
---

Create a migration for: **$ARGUMENTS**

Read `.claude/rules/data-and-rls.md` first and match existing migrations in `supabase/migrations/`.

Requirements:
- One focused change per migration, named `<verb_noun>` (e.g. `create_prescriptions_table`, `add_rls_predictions`).
- Standard columns on new tables: `id uuid pk default gen_random_uuid()`, `created_at`/`updated_at timestamptz` with the `updated_at` trigger, soft-delete (`deleted_at`) where the data has clinical/audit value.
- Explicit, indexed foreign keys.
- Money as integer minor units.
- **RLS enabled + policies in this same file**, matching the RBAC matrix (`admin` / `veterinarian` / `staff`). Add a comment stating what each policy allows and denies.
- Forward-only. Flag any destructive operation (drop/alter that loses data) explicitly and confirm before including it.

After writing the SQL, output the exact commands to apply it and to regenerate types (`npm run db:types`), and note the RLS negative-case to verify manually (which role should be denied).
