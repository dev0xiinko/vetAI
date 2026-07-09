import { z } from "zod";

/**
 * Validated input for a disease-prediction run. Only what the feature needs —
 * species, age, symptoms — never owner PII. Validate at the boundary (in the
 * server action / route handler) before the model call. See ai-features.md.
 */
export const predictionInputSchema = z.object({
  species: z.string().trim().min(1).max(60),
  ageMonths: z.number().int().nonnegative().max(600),
  symptoms: z.array(z.string().trim().min(1).max(200)).min(1).max(30),
  notes: z.string().trim().max(1000).optional(),
});

export type PredictionInput = z.infer<typeof predictionInputSchema>;

/** One suggested condition returned by the model, after validation. */
export const predictionConditionSchema = z.object({
  condition: z.string().trim().min(1).max(200),
  /** 0..1 — a likelihood, never a certainty. Rendered as confidence in the UI. */
  likelihood: z.number().min(0).max(1),
  rationale: z.string().trim().min(1).max(2000),
  recommended_next_step: z.string().trim().min(1).max(2000),
});

export type PredictionCondition = z.infer<typeof predictionConditionSchema>;

/**
 * The model must return MORE THAN ONE possibility with explicit uncertainty.
 * A single confident answer is a red flag (ai-features.md) — enforce >= 2 here
 * so a malformed/over-confident response is rejected rather than displayed.
 */
export const predictionOutputSchema = z.array(predictionConditionSchema).min(2);

export type PredictionOutput = z.infer<typeof predictionOutputSchema>;
