# Frontend rules — Next.js App Router

Applies to everything under `src/app` and `src/components`.

## Component model

- **Default to Server Components.** Fetch data on the server, pass plain data down. Add `"use client"` only for interactivity (state, effects, event handlers, browser APIs).
- Data mutations go through **Server Actions** in `src/server/<module>/`, not client-side fetch to your own API, unless the flow needs streaming (chatbot) — then use a Route Handler.
- Never import anything from `src/lib/supabase/admin.ts` (service-role) into a client component. If a client file imports it, that's a bug — stop and move the logic server-side.

## Routing & layout

- One route group per module: `(dashboard)/pets`, `(dashboard)/records`, `(dashboard)/prediction`, `(dashboard)/chatbot`, `(dashboard)/reports`, `(dashboard)/users`, plus `(auth)/login`.
- Guard protected routes in the group's `layout.tsx`: resolve the session server-side, redirect to `/login` if absent, and check role for role-restricted modules (User Management = `admin` only). This guard is a UX layer — RLS is still the real boundary.
- Loading and error UI: use `loading.tsx` and `error.tsx` per route. Every list view has an empty state.

## Forms & validation

- Forms are controlled client components that call a Server Action.
- Every action re-validates its input with the **same zod schema** the form uses (import from `src/lib/validation/`). Never trust client-validated data.
- Return typed results from actions: `{ ok: true, data }` or `{ ok: false, error }`. Surface errors inline, don't `throw` across the boundary.

## UI

- Use the shadcn/ui-style primitives in `components/ui`. Keep feature components thin — logic lives in server actions and `lib/`.
- Tailwind for styling. No inline design tokens scattered around; keep spacing/color consistent with existing components.
- Accessibility: label every input, keyboard-navigable dialogs, sufficient contrast. This is a tool clinic staff use all day — don't make it painful.

## Performance (target: page interactive ≤ 3s)

- Fetch only the columns you render. Paginate lists (pets, records) — never `select *` an unbounded table into a page.
- Stream the chatbot response; don't block on the full completion.
- Avoid client-side waterfalls: fetch in the Server Component, pass down.

## Don't

- Don't fetch secrets or the service-role client into client code.
- Don't put business rules only in the UI — they must also hold at the DB/action layer.
- Don't add a global state library for something server state already covers.
