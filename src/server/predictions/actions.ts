"use server";

import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { predictionInputSchema } from "@/lib/validation/prediction";
import { executePrediction } from "@/server/predictions/run";

export type { RunPredictionResult } from "@/server/predictions/run";
import type { RunPredictionResult } from "@/server/predictions/run";

/** Run input = the model input plus an optional pet to link the run to. */
const runInputSchema = predictionInputSchema.extend({
  pet_id: z.string().uuid().optional(),
});

/**
 * Run a disease prediction and persist the audit row.
 *
 * Only a veterinarian or admin may run one (mirrors the RLS insert policy) —
 * enforced by the shared `executePrediction` executor, along with the rate
 * limit and audit insert. Output is advisory data to display — it triggers
 * no automatic action (no auto-diagnosis, no auto-prescribe). The model call
 * already validates input, keeps symptoms in the user role, and sends no
 * owner PII.
 */
export async function runPrediction(
  raw: unknown,
): Promise<RunPredictionResult> {
  const session = await requireSession();

  const parsed = runInputSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "invalid_input",
      message: "Please provide species, age, and at least one symptom.",
    };
  }

  const { pet_id, ...input } = parsed.data;
  return executePrediction(session, input, pet_id ?? null);
}
