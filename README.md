# VetiAssist AI

Veterinary clinic management system with two AI-assisted features — **symptom-based disease prediction** and a **clinic chatbot**. Built for licensed veterinary clinic staff. All AI output is decision support only; it never replaces a licensed vet's judgment.

## Table of contents

- [Stack](#stack)
- [Prerequisites](#prerequisites)
- [Installation guide](#installation-guide)
- [Environment variables](#environment-variables)
- [Database setup](#database-setup)
- [Running the app](#running-the-app)
- [Available scripts](#available-scripts)
- [Project guide](#project-guide)
  - [Directory structure](#directory-structure)
  - [Core modules](#core-modules)
  - [How the pieces fit together](#how-the-pieces-fit-together)
  - [Data model](#data-model)
  - [AI features](#ai-features)
  - [Security model](#security-model)
- [Testing](#testing)
- [Definition of done](#definition-of-done)

## Stack

| Layer | Technology |
| --- | --- |
| Frontend | Next.js 16 (App Router) + React 19 + TypeScript (strict) |
| Styling | Tailwind CSS v4, `lucide-react` icons |
| Backend | Next.js Route Handlers / Server Actions (no separate server) |
| Database & Auth | Supabase (PostgreSQL) — Row Level Security is the access-control boundary |
| AI | OpenRouter (OpenAI-compatible) via the `openai` SDK |
| Validation | Zod |
| Testing | Vitest |

## Prerequisites

- Node.js 20+ and npm
- A [Supabase](https://supabase.com) project (free tier is fine)
- An [OpenRouter](https://openrouter.ai) API key
- (Optional, for local DB workflows) the [Supabase CLI](https://supabase.com/docs/guides/cli)

## Installation guide

1. **Clone and install dependencies**

   ```bash
   git clone <repo-url>
   cd vetAI
   npm install
   ```

2. **Create your environment file**

   ```bash
   cp .env.example .env.local
   ```

   Fill in the values — see [Environment variables](#environment-variables) below.

3. **Set up the database** — apply the migrations in `supabase/migrations/` to your Supabase project (see [Database setup](#database-setup)).

4. **Regenerate database types**

   ```bash
   npm run db:types
   ```

5. **Run the dev server**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

6. **Create your first user.** Sign up through the app, then promote that user to `admin` by setting `role = 'admin'` on their `profiles` row (via the Supabase SQL editor or dashboard). All other roles are managed from the app's User Management module by an admin.

## Environment variables

Copy `.env.example` to `.env.local` and fill in:

```bash
# Supabase (app)
NEXT_PUBLIC_SUPABASE_URL=            # Project Settings → API
NEXT_PUBLIC_SUPABASE_ANON_KEY=       # Project Settings → API
SUPABASE_SERVICE_ROLE_KEY=           # SERVER ONLY — never expose to the client

# OpenRouter (OpenAI-compatible LLM gateway) — powers prediction + chatbot
OPENROUTER_API_KEY=                  # SERVER ONLY — never expose to the client
OPENROUTER_MODEL=openai/gpt-4o-mini  # optional; any OpenRouter "vendor/model" slug
OPENROUTER_SITE_URL=                 # optional attribution (HTTP-Referer)
OPENROUTER_APP_NAME=                 # optional attribution (X-Title)

# Supabase MCP (for Claude Code DB introspection — see .mcp.json)
SUPABASE_PROJECT_REF=                # your project ref, e.g. abcdefghijklmnop
SUPABASE_ACCESS_TOKEN=               # personal access token from supabase.com/dashboard/account/tokens
```

> `SUPABASE_SERVICE_ROLE_KEY` and `OPENROUTER_API_KEY` bypass Row Level Security / cost money respectively — keep them server-side and out of version control. `.env*` is already git-ignored except `.env.example`.

## Database setup

Migrations live in `supabase/migrations/`, one change per file, RLS policies included in the same file that creates each table.

**With the Supabase CLI, linked to your project:**

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

**Creating a new migration:**

```bash
supabase migration new <verb_noun>   # e.g. create_pets_table
```

After any schema change, regenerate the generated TypeScript types:

```bash
npm run db:types
```

Every table must ship with RLS enabled and at least one policy — see the RBAC matrix in [Security model](#security-model). No destructive migration (drop column/table) without an explicit data-safety review.

## Running the app

```bash
npm run dev      # local dev server, http://localhost:3000
npm run build    # production build
npm run start    # run the production build
```

## Available scripts

```bash
npm run dev          # local dev server
npm run build        # production build (must pass before a change is "done")
npm run start         # run production build
npm run lint          # eslint
npm run typecheck     # tsc --noEmit
npm run test           # run tests once (vitest)
npm run test:watch     # tests in watch mode
npm run db:types      # regenerate Supabase TS types into src/lib/database.types.ts
```

## Project guide

### Directory structure

```text
src/
  app/                     # App Router
    (auth)/login/          # public auth routes
    (dashboard)/           # protected routes: owners, pets, records,
                            # prediction, chatbot, reports, users
    api/                   # route handlers (chatbot streaming, reports export)
  components/
    ui/                    # shadcn-style primitives
    <feature>/              # feature components (pets, owners, predictions, chat, ...)
    shell/                  # sidebar/topbar app shell
  lib/
    supabase/              # server.ts, client.ts, admin.ts (service-role — SERVER ONLY)
    ai/                    # openai.ts client + prediction.ts + chatbot.ts + prompts/
    validation/             # zod schemas, shared by forms and server actions
    auth/                   # session/role helpers
    database.types.ts       # generated Supabase types (do not hand-edit)
  server/                  # server actions, grouped by module
  test/                    # vitest setup/helpers
supabase/
  migrations/               # SQL migrations — RLS lives here, one change per file
  seed.sql
```

### Core modules

Each maps to a menu section in the app: **Auth**, **Dashboard**, **User Management**, **Pet & Owner Profiles**, **Medical Records**, **Disease Prediction**, **Chatbot**, **Report Generation**.

### How the pieces fit together

- **Auth** is Supabase Auth. Every request resolves a session server-side; the UI trusts nothing on its own.
- **RBAC** roles are `admin`, `veterinarian`, `staff`, stored on `profiles.role`. Enforcement is **RLS-first** in the database, with route/action guards as a UX-layer second line — never the only layer.
- **Medical records** hang off `pets`, which hang off `owners`. Records cover vaccinations, diagnoses, and prescriptions.
- **Disease prediction**: symptoms in → OpenRouter model → a ranked list of *suggested* conditions with confidence, persisted as a `predictions` row for the audit trail.
- **Chatbot**: a scoped Q&A/FAQ assistant. Answers general and clinic-info questions; never issues a diagnosis or prescription, and defers treatment decisions to the vet.
- **Reports**: aggregate queries (disease trends, patient records, clinic activity), viewable and exportable.

### Data model

Core tables: `profiles` (role) · `owners` · `pets` (fk `owner_id`) · `medical_records` (fk `pet_id`) · `vaccinations` · `diagnoses` · `prescriptions` · `predictions` (symptom input + AI output + the veterinarian who ran it) · `chat_sessions` / `chat_messages` · `reports`.

Conventions: `snake_case` names, plural tables, `id`/`created_at`/`updated_at` on every table, explicit indexed foreign keys, money as integer minor units (never floats), and soft delete (`deleted_at`) for clinically/audit-relevant records.

### AI features

- One LLM client (`lib/ai/openai.ts`) wraps OpenRouter via the `openai` SDK; server-side only.
- Prompts are versioned in `lib/ai/prompts/`, not edited in place.
- Disease prediction always returns **more than one** possibility with explicit likelihood — a single confident answer is treated as a prompt bug.
- Every AI surface shows a visible advisory disclaimer and defers to clinical judgment. No AI output triggers a privileged action automatically (no auto-prescribe, no auto-diagnosis record).
- User-controlled input (symptoms, chat messages) is never concatenated into the system prompt — it stays in user-role messages to prevent prompt injection.

### Security model

- **RLS is the security boundary.** Every table has RLS enabled with policies defined in the migration that creates it.
- The Supabase service-role key (`lib/supabase/admin.ts`) is server-only, used sparingly, and always behind an explicit role check — never in a client component or an unguarded route handler.
- Owner/pet data is personal data under the PH Data Privacy Act: no PII in logs, and only the minimum needed fields are sent to the AI model.
- Every server action / route handler validates input with a Zod schema before touching the database or the model.

## Testing

- **Unit:** validation schemas, pure helpers (prediction parsing, report aggregation, money math).
- **Integration:** server actions and route handlers, including RLS negative cases (a `staff` user must be denied where the matrix forbids it).
- **AI features:** the OpenAI/OpenRouter client is mocked — tests never hit the live API. Covers input validation, output parsing, malformed-response handling, and prompt-injection resistance.

```bash
npm run test        # run once
npm run test:watch  # watch mode
```

## Definition of done

A change is considered done when:

1. `npm run typecheck` passes.
2. `npm run lint` passes.
3. `npm run build` succeeds.
4. New/changed tables ship with RLS policies in the same migration, and types are regenerated (`npm run db:types`).
5. Any AI-surface change keeps the disclaimer/advisory framing intact.
6. Relevant tests are added or updated.
