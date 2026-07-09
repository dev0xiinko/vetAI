import "server-only";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { SessionProfile } from "@/lib/auth/session";
import { predictDisease } from "@/lib/ai/prediction";
import type { PredictionInput, PredictionOutput } from "@/lib/validation/prediction";
import type { Json } from "@/lib/database.types";

// Basic per-veterinarian rate limit on the paid model call.
const RATE_WINDOW_MS = 60_000;
const RATE_MAX_PER_WINDOW = 15;

export type RunPredictionResult =
  | {
      ok: true;
      data: {
        id: string | null;
        conditions: PredictionOutput;
        model: string;
        promptVersion: string;
      };
    }
  | { ok: false; error: string; message: string };

/**
 * Shared prediction executor — the ONE code path for running a disease
 * prediction and persisting its audit row, used by both the Prediction page
 * server action and the in-chat tool call (ai-features.md: one entry point,
 * same rate limit, same audit trail).
 *
 * Contains, in order: the role gate (admin/veterinarian only — mirrors the
 * RLS insert policy), the per-vet rate limit, the model call, and the audit
 * insert with fail-closed behavior (an unrecorded run is never returned as a
 * success). Output is advisory data to display — it triggers no automatic
 * action (no auto-diagnosis, no auto-prescribe).
 */
export async function executePrediction(
  session: SessionProfile,
  input: PredictionInput,
  petId: string | null,
): Promise<RunPredictionResult> {
  if (session.role !== "admin" && session.role !== "veterinarian") {
    return {
      ok: false,
      error: "forbidden",
      message: "Only a veterinarian may run a prediction.",
    };
  }

  const supabase = await createClient();

  // Rate limit BEFORE the paid model call: cap runs per vet per window.
  const since = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
  const { count: recentRuns } = await supabase
    .from("predictions")
    .select("id", { count: "exact", head: true })
    .eq("veterinarian_id", session.userId)
    .gte("created_at", since);
  if ((recentRuns ?? 0) >= RATE_MAX_PER_WINDOW) {
    return {
      ok: false,
      error: "rate_limited",
      message: "Too many predictions in a short time. Please wait a moment and try again.",
    };
  }

  const result = await predictDisease(input);
  if (!result.ok) {
    return result; // typed graceful failure (unavailable / bad output)
  }

  // Persist the audit row (input, output, model + prompt version, who ran it).
  const { data, error } = await supabase
    .from("predictions")
    .insert({
      veterinarian_id: session.userId,
      pet_id: petId,
      input: input as unknown as Json,
      output: result.data.conditions as unknown as Json,
      model: result.data.model,
      prompt_version: result.data.promptVersion,
    })
    .select("id")
    .single();

  if (error || !data) {
    // Auditing every run is mandatory — fail closed rather than showing an
    // unrecorded result. Log only the DB error code (never PII/prompt/output).
    console.error("prediction audit insert failed", { code: error?.code });
    return {
      ok: false,
      error: "audit_write_failed",
      message: "The prediction could not be recorded. Please try again.",
    };
  }

  revalidatePath("/prediction");
  return {
    ok: true,
    data: {
      id: data.id,
      conditions: result.data.conditions,
      model: result.data.model,
      promptVersion: result.data.promptVersion,
    },
  };
}
