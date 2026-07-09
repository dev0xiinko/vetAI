# Testing & quality rules

## Definition of done

A change is done when **all** hold:

1. `npm run typecheck` passes (no `any`-escapes to silence it).
2. `npm run lint` passes.
3. `npm run build` succeeds.
4. New DB tables/changes ship with RLS policies in the same migration, and types were regenerated.
5. If it touches an AI surface, the disclaimer/advisory framing is intact (see `ai-features.md`).
6. Relevant tests added or updated.

Don't report a task complete without running the checks above.

## Testing approach

- **Unit:** validation schemas (zod), pure helpers (prediction parsing, report aggregation, money math).
- **Integration:** server actions and route handlers against a test Supabase (or mocked client), including the **RLS negative cases** — assert a `staff` user is denied where the matrix says so.
- **AI features:** mock the OpenAI client. Test that: input is validated, output is parsed/validated, malformed model output is handled gracefully, and injection-style input doesn't escape the user role. Don't hit the live API in tests.
- **E2E (optional, high value here):** the core flows the clinic actually does daily — add pet → add record → run prediction → view report. A Playwright harness fits this well.

## User Acceptance Testing (UAT)

This project's methodology includes UAT with real clinic staff. Keep a short, living UAT checklist per module (login, profiles, records, prediction, chatbot, reports) mapping to the acceptance criteria. When a module is UAT-ready, note what a tester should verify and what "pass" means. Capture feedback as issues, not vibes.

## Non-functional targets (from the spec)

- **Performance:** pages interactive within ~3s; see the performance section in `frontend.md`.
- **Security:** RLS on every table; no service-role key client-side; input validated at the boundary; PII kept out of logs and model prompts.
- **Reliability:** AI/model failures degrade gracefully, never crash the page.
- **Usability:** labeled forms, empty/loading/error states, keyboard-navigable.
- **Maintainability:** small modules, generated DB types, prompts versioned, conventions in these rules files.
- **Compatibility:** works on current evergreen browsers; responsive for tablet use at the front desk.

## Reviews

Before shipping anything touching auth, RLS, PII, or an AI surface, run the `security-reviewer` subagent (or `/security-review` on the diff). It checks for RLS gaps, service-role exposure, PII leakage, and prompt-injection surface.
