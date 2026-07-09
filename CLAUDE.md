# VetiAssist AI

Veterinary clinic management system with two AI-assisted features: **symptom-based disease prediction** and a **clinic chatbot**. Built for use inside a veterinary clinic by licensed staff.

This file is the project brief Claude loads every session. Keep it accurate. When a convention changes, update it here (or run `/memory`).

---

## What we're building

A web app where clinic staff manage pets, owners, and medical records, and where an AI layer helps veterinarians by (a) suggesting likely conditions from entered symptoms and (b) answering questions via a chatbot. All AI output is **decision support for a licensed vet — never an autonomous diagnosis.** See `@.claude/rules/ai-features.md`; this constraint is non-negotiable.

Core modules (each maps to a menu section): Auth, Dashboard, User Management, Pet & Owner Profiles, Medical Records, Disease Prediction, Chatbot, Report Generation.

## Stack

- **Frontend:** Next.js (App Router) + React + TypeScript (strict mode)
- **Backend:** Node.js — via Next.js Route Handlers / Server Actions (no separate server unless a rule says otherwise)
- **Database + Auth:** Supabase (PostgreSQL). Row Level Security is the primary access-control boundary.
- **AI:** OpenRouter (OpenAI-compatible) via the `openai` SDK — one wrapper module, two use cases (prediction, chatbot). Model is a `vendor/model` slug set by `OPENROUTER_MODEL`.
- **Tooling:** VS Code, GitHub, ESLint + Prettier, TypeScript compiler for type-check

> Pin exact versions in `package.json`. When you touch a dependency, check the installed version — don't assume from training data.

## Commands

Run these; don't guess whether they exist. Update this list if scripts change.

```bash
npm run dev          # local dev server
npm run build        # production build (must pass before "done")
npm run start        # run production build
npm run lint         # eslint
npm run typecheck    # tsc --noEmit  (add this script if missing)
npm run test         # unit/integration tests
npm run db:types     # regenerate Supabase TS types into src/lib/database.types.ts
```

If a Supabase CLI is set up: `supabase migration new <name>`, `supabase db push`, `supabase db reset`.

## Directory shape (target)

```
src/
  app/                  # App Router. Route groups per module, e.g. (dashboard)/pets, (dashboard)/records
    api/                # Route Handlers for AI + server work
  components/           # ui/ (shadcn-style primitives) + feature components
  lib/
    supabase/           # server.ts, client.ts, admin.ts (service-role — SERVER ONLY)
    ai/                 # openai.ts client + prediction.ts + chatbot.ts + prompts/
    validation/         # zod schemas, shared with forms and server
    database.types.ts   # generated Supabase types
  server/               # server actions, grouped by module
supabase/
  migrations/           # SQL migrations, RLS lives here
  seed.sql
```

## How the pieces fit

- **Auth** is Supabase Auth. Every request resolves a session server-side; UI trusts nothing.
- **RBAC** roles: `admin`, `veterinarian`, `staff`. A user's role lives in a `profiles` (or `user_roles`) row. Enforcement is **RLS-first** (DB) with route/action guards as a second layer, never the only layer. Matrix: `@.claude/rules/data-and-rls.md`.
- **Medical records** hang off `pets`, which hang off `owners`. Records include vaccinations, diagnoses, and prescriptions.
- **Disease prediction**: symptoms in → OpenAI → ranked *suggested* conditions with confidence + a persisted `predictions` row for history. It reads/writes DB only through the vet's session.
- **Chatbot**: scoped Q&A / FAQ assistant. Answers general and clinic-info questions; does **not** issue diagnoses or prescribe. Refuses/deflects treatment decisions to the vet.
- **Reports**: aggregate queries (disease trends, patient records, clinic activity) → viewable + exportable.

## Data model (core tables)

`profiles` (role) · `owners` · `pets` (fk owner) · `medical_records` (fk pet) · `vaccinations` · `diagnoses` · `prescriptions` · `predictions` (symptom input + AI output + vet who ran it) · `chat_sessions` / `chat_messages` · `reports` (or generated on the fly).

Conventions for these tables — naming, timestamps, soft-delete/audit, money as integer, RLS — are in `@.claude/rules/data-and-rls.md`.

## Non-negotiables

1. **AI is advisory.** Prediction results and chatbot answers are never presented as diagnosis. Every AI surface carries a visible disclaimer and defers to a licensed vet. `@.claude/rules/ai-features.md`.
2. **RLS is the security boundary.** No table exposed without a policy. The service-role key **never** reaches the client. `@.claude/rules/data-and-rls.md`.
3. **Owner/pet data is personal data** under the PH Data Privacy Act. No PII in logs, in prompts sent to OpenAI beyond what the feature needs, or in client bundles.
4. **Validate at the boundary.** Every server action / route handler validates input with a zod schema before touching the DB or the model.
5. **Type-check and build must pass** before a task is done. See `@.claude/rules/testing-and-quality.md`.

## Working style

- Prefer **Server Components** and Server Actions; reach for `"use client"` only when you need interactivity. `@.claude/rules/frontend.md`.
- Small, reviewable changes. Touch one module per change where possible.
- When a task spans schema + backend + UI, follow the vertical-slice pattern in `/scaffold-feature`.
- Don't invent product scope. If a feature isn't in the menu structure above, ask before building it.

## Rules index

- `@.claude/rules/frontend.md` — Next.js App Router, components, forms, performance
- `@.claude/rules/data-and-rls.md` — Supabase schema, migrations, RLS, RBAC matrix
- `@.claude/rules/ai-features.md` — OpenAI usage, prediction + chatbot safety
- `@.claude/rules/testing-and-quality.md` — testing, UAT, non-functional targets, definition of done
