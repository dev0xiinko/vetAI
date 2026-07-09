# AI feature rules — OpenAI (disease prediction + chatbot)

Applies to `src/lib/ai/**` and any route/action that calls the model. Read this before touching either AI feature.

## The one rule everything else serves

**The AI assists a licensed veterinarian. It does not diagnose, and it does not prescribe.** Prediction output is a *ranked list of possibilities to investigate.* The chatbot answers questions and defers clinical decisions to the vet. If a change would make the AI look like it's giving a definitive diagnosis or a treatment order, don't make it.

## Structure

- One LLM client: `lib/ai/openai.ts` — the `openai` SDK pointed at OpenRouter (OpenAI-compatible). Key comes from `process.env.OPENROUTER_API_KEY`, server-side only; the model is an OpenRouter `vendor/model` slug via `OPENROUTER_MODEL`. The key must never appear in a client bundle, a NEXT_PUBLIC_ var, or a log line.
- Prompts live as versioned files/constants in `lib/ai/prompts/`, not inlined and edited in place. When you change a prompt, note it — prediction output is auditable.
- `lib/ai/prediction.ts` and `lib/ai/chatbot.ts` are the only entry points. Callers (route handlers / actions) validate input, call these, and handle the typed result.

## Disease prediction

- Input: a validated set of symptoms/observations for a specific pet (species, age, and symptoms). Validate with zod before the call.
- Ask the model for **structured output**: an array of `{ condition, likelihood, rationale, recommended_next_step }`, ordered by likelihood. Parse and validate the JSON; never render raw model text as if it were data.
- Always return **more than one** possibility with explicit uncertainty. A single confident answer is a red flag — treat it as a bug in the prompt.
- Persist a `predictions` row every run: input, output, model + prompt version, and the veterinarian who ran it.
- Every prediction UI shows: the disclaimer, the confidence/likelihood per item, and a clear "confirm with clinical judgment / diagnostics" framing. No auto-actions off a prediction (no auto-prescribe, no auto-record-as-diagnosis).

## Chatbot

- Scope it: clinic FAQs, general pet-care information, and how-to-use-the-app help. System prompt states it is an assistant, not a vet, and must recommend seeing the veterinarian for anything diagnostic, urgent, or medication-related.
- Stream responses for latency. Persist to `chat_sessions` / `chat_messages` scoped to the user.
- It answers from provided/clinic context where possible; if it doesn't know, it says so rather than inventing. No fabricated dosages, drug names, or medical claims.

## Treat model input as untrusted (prompt injection)

- Symptom fields and chat messages are user-controlled. Never concatenate them into a system prompt in a way that lets them override instructions. Keep user content in user-role messages; keep rules in the system message.
- Don't let the model's output trigger privileged actions directly. Output is data to display or a suggestion to persist — a human vet acts on it.

## Privacy toward the model

- Send the model only what the feature needs (species, age, symptoms; the question). Don't ship owner names, addresses, contact info, or unrelated record history into the prompt.
- No PII or full prompts/outputs in application logs. If you log for debugging, redact and keep it out of production.

## Reliability

- Wrap every model call in try/catch with a timeout and a user-facing fallback ("prediction unavailable, try again"). A model outage must not break the page.
- Handle rate limits with a clear message, not a crash.
- Consider caching FAQ-style chatbot answers; never cache a per-pet prediction across pets.
