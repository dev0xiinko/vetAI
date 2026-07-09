import { z } from "zod";

/** A chat send. Re-validated in the route handler before the model call. */
export const chatSendSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  // nullish: the client sends `null` for a brand-new chat (no session yet).
  sessionId: z.string().uuid().nullish(),
  // The pet this chat is linked to. `null` clears the link; `undefined`
  // (field omitted) leaves whatever the chat_sessions row already has.
  petId: z.string().uuid().nullish(),
});

export type ChatSendInput = z.infer<typeof chatSendSchema>;

/**
 * Server-side validation of MODEL-supplied tool call arguments — untrusted
 * input (ai-features.md: treat model output as data, validate before acting).
 * The model may only ever supply symptoms/notes and an age fallback; species
 * and the real age (when the pet's date of birth is known) always come from
 * the pet's DB row, never from here.
 */
export const predictionToolArgsSchema = z.object({
  symptoms: z.array(z.string().trim().min(1).max(200)).min(1).max(30),
  notes: z.string().trim().max(1000).optional(),
  age_months: z.coerce.number().int().min(0).max(600).optional(),
});

export type PredictionToolArgs = z.infer<typeof predictionToolArgsSchema>;
