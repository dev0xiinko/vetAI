---
description: Build or modify an OpenAI-backed feature (disease prediction or chatbot) with the required safety, validation, and privacy guardrails.
argument-hint: <what to build/change, e.g. "add confidence bars to prediction output" or "scope the chatbot to clinic FAQs">
allowed-tools: Read, Grep, Glob, Edit, Write, Bash
---

Work on this AI feature: **$ARGUMENTS**

**Read `.claude/rules/ai-features.md` in full before writing any code.** The core constraint: the AI assists a licensed vet — it does not diagnose or prescribe. Do not make a change that undermines that framing.

Implement against these guardrails:
- Use the single `lib/ai/openai.ts` client; key is server-only, never client-side or logged.
- Keep prompts in `lib/ai/prompts/` (versioned), not inlined ad hoc.
- Validate input with a zod schema before the model call.
- For **prediction**: request structured JSON, parse and validate it, return multiple possibilities with explicit likelihood, and persist a `predictions` audit row (input, output, model + prompt version, veterinarian id). No auto-actions off a prediction.
- For **chatbot**: stream the response, keep it scoped, defer diagnostic/medication questions to the vet, and never fabricate dosages or drug facts.
- Treat symptom/message input as untrusted: user content stays in user-role messages; rules stay in the system message; output is data to display, not a trigger for privileged actions.
- Send the model only what the feature needs — no owner PII in prompts. Redact/keep prompts and outputs out of logs.
- Wrap the call with a timeout and a graceful user-facing fallback; handle rate limits without crashing.

Confirm every AI-facing UI still shows the advisory disclaimer and per-item confidence. When done, note that the `security-reviewer` subagent should review the diff for injection surface and PII leakage.
