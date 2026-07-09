---
description: Scaffold a full vertical slice (schema + RLS + types + validation + server action + route + UI) for a VetiAssist module or entity.
argument-hint: <entity or module, e.g. "vaccination records" or "owner profiles">
allowed-tools: Read, Grep, Glob, Edit, Write, Bash
---

Scaffold an end-to-end vertical slice for: **$ARGUMENTS**

Follow the project's conventions in CLAUDE.md and `.claude/rules/`. Before writing, read the relevant rules files and look at an existing module to match patterns. Then produce, in order:

1. **Migration** (`supabase/migrations/`): table(s) with the standard columns (uuid id, created_at, updated_at + trigger, soft-delete where it has clinical value), explicit indexed FKs, and **RLS enabled with policies in the same file** per the RBAC matrix in `data-and-rls.md`. State in a comment what each policy allows/denies.
2. **Types**: note that `npm run db:types` must be run, and use the generated `Database` types (don't hand-write row types).
3. **Validation** (`src/lib/validation/`): zod schema(s) for create/update input.
4. **Server action(s)** (`src/server/<module>/`): validate input with the zod schema, call Supabase via the session-scoped server client, return `{ ok, data } | { ok, error }`. Enforce the role check that mirrors RLS.
5. **Route group + UI** (`src/app/(dashboard)/<module>/`): Server Component list/detail with pagination, empty/loading/error states, and a client form component wired to the action. Guard the route by session + role in the group layout.
6. **Wire the menu** entry so it appears in the dashboard nav for the roles allowed.

Rules of the road:
- RLS is mandatory — no table without a policy.
- Never import the service-role client into anything client-side.
- Validate at the boundary; don't trust the form.
- Keep it to this one slice. If the entity implies AI or reporting work, stop and confirm scope before expanding.

End by listing exactly what to run (`npm run db:types`, migration push, `npm run typecheck && npm run build`) and what still needs manual verification (RLS negative case, UAT check).
