# Data & RLS rules — Supabase / PostgreSQL

Applies to `supabase/migrations/`, `src/lib/supabase/`, and any server code that queries the DB.

## Supabase clients

Three clients, three jobs:

- `lib/supabase/server.ts` — request-scoped, uses the user's session (cookies). **Use this for almost everything.** RLS applies.
- `lib/supabase/client.ts` — browser client, anon key, session-aware. Only for client components that read RLS-protected data.
- `lib/supabase/admin.ts` — **service-role, SERVER ONLY.** Bypasses RLS. Import only in trusted server code (e.g. admin user provisioning). Never in a client file, never in a Route Handler that echoes raw results to an untrusted caller. Guard every use with an explicit role check first.

## RLS is the security boundary

- **Every table has RLS enabled and at least one policy.** A table with RLS off is a security bug — do not ship it.
- Write policies in the migration that creates the table, in the same file. Don't leave "add RLS later" TODOs.
- Test the negative case: a `staff` user must not be able to read/write rows an `admin`/`veterinarian` restriction forbids. When you add a policy, state in the PR description what it allows and denies.

## RBAC matrix (starting point — adjust with the client)

Role is stored on `profiles.role` (`admin` | `veterinarian` | `staff`).

| Module | admin | veterinarian | staff |
|---|---|---|---|
| User Management | full | — | — |
| Pet & Owner Profiles | full | read/write | read/write |
| Medical Records | full | create/update | read + intake fields |
| Disease Prediction | full | run + view history | view own clinic history |
| Chatbot | full | full | full |
| Reports | full | clinical reports | activity reports |

Encode this in RLS with a helper like `auth_role()` (a SQL function reading the caller's `profiles.role`). Route/layout guards mirror it for UX but are not a substitute.

## Schema conventions

- `snake_case` table and column names; plural table names (`pets`, `medical_records`).
- Every table: `id uuid primary key default gen_random_uuid()`, `created_at timestamptz not null default now()`, `updated_at timestamptz not null default now()` (with an `updated_at` trigger).
- Foreign keys explicit and indexed. `pets.owner_id → owners.id`, `medical_records.pet_id → pets.id`, etc.
- **Money as integer minor units** (centavos), never floats.
- Prefer soft delete (`deleted_at timestamptz`) for records with clinical/audit value (owners, pets, medical_records) so history is preserved. Hard delete only where it's genuinely transient.
- `predictions` stores the raw symptom input, the model output (suggested conditions + scores), the model/version, and the `veterinarian_id` who ran it — this is the audit trail for AI use.

## Migrations

- One change per migration file, named `supabase migration new <verb_noun>` (e.g. `create_pets_table`, `add_rls_medical_records`).
- Migrations are forward-only and reviewable SQL. No destructive change (drop column, drop table) without an explicit note and a data-safety check.
- After a schema change, regenerate types: `npm run db:types`. Code uses the generated `Database` types, not hand-written row types.

## Querying

- Select explicit columns. Paginate anything that grows (records, predictions, chat_messages).
- Do joins in the query, not in JS loops.
- Wrap multi-statement writes that must be atomic in a Postgres function / transaction.
