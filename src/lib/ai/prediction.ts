import {
  predictionInputSchema,
  predictionOutputSchema,
  type PredictionInput,
  type PredictionOutput,
} from "@/lib/validation/prediction";
import {
  buildPredictionMessages,
  PREDICTION_PROMPT_VERSION,
  type ChatMessage,
} from "@/lib/ai/prompts/prediction";
import { DEFAULT_MODEL } from "@/lib/ai/openai";

const MODEL_TIMEOUT_MS = 20_000;

export type PredictionSuccess = {
  ok: true;
  data: {
    conditions: PredictionOutput;
    model: string;
    promptVersion: string;
  };
};

export type PredictionFailure = {
  ok: false;
  error: "invalid_input" | "model_output_invalid" | "model_unavailable";
  message: string;
};

export type PredictionResult = PredictionSuccess | PredictionFailure;

/**
 * A model caller: takes messages, returns the raw text content. Injected so the
 * orchestrator can be tested without hitting the live API (ai-features.md:
 * "mock the OpenAI client"). Defaults to the real client in production.
 */
export type ModelCaller = (
  messages: ChatMessage[],
  opts: { model: string },
) => Promise<string>;

/**
 * Parse + validate raw model output into ranked conditions.
 *
 * Pure and exported for unit testing. Rejects:
 * - non-JSON / wrong shape (never renders raw model text as data),
 * - a single over-confident answer (schema requires >= 2 conditions).
 * Returns conditions sorted by likelihood, highest first.
 */
export function parsePredictionResponse(raw: string): PredictionOutput {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Model output was not valid JSON");
  }

  const container =
    parsed && typeof parsed === "object" && "conditions" in parsed
      ? (parsed as { conditions: unknown }).conditions
      : parsed;

  const conditions = predictionOutputSchema.parse(container);
  return [...conditions].sort((a, b) => b.likelihood - a.likelihood);
}

async function defaultModelCall(
  messages: ChatMessage[],
  opts: { model: string },
): Promise<string> {
  // Imported lazily so tests never touch the real client or its API key.
  const { getOpenAIClient } = await import("@/lib/ai/openai");
  const completion = await getOpenAIClient().chat.completions.create({
    model: opts.model,
    messages,
    response_format: { type: "json_object" },
    temperature: 0.2,
  });
  return completion.choices[0]?.message?.content ?? "";
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Model call timed out")),
      ms,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

/**
 * Run a disease prediction end to end: validate input, build injection-safe
 * messages, call the model with a timeout, parse/validate the output. Never
 * throws across the boundary — returns a typed result so a model outage
 * degrades gracefully instead of crashing the page (ai-features.md: Reliability).
 *
 * Persisting the `predictions` audit row is the caller's job (it needs the
 * session-scoped Supabase client + veterinarian id).
 */
export async function predictDisease(
  rawInput: unknown,
  deps: { call?: ModelCaller; model?: string } = {},
): Promise<PredictionResult> {
  const parsedInput = predictionInputSchema.safeParse(rawInput);
  if (!parsedInput.success) {
    return {
      ok: false,
      error: "invalid_input",
      message: "Symptom input failed validation.",
    };
  }

  const input: PredictionInput = parsedInput.data;
  const model = deps.model ?? DEFAULT_MODEL;
  const call = deps.call ?? defaultModelCall;
  const messages = buildPredictionMessages(input);

  let raw: string;
  try {
    raw = await withTimeout(call(messages, { model }), MODEL_TIMEOUT_MS);
  } catch {
    return {
      ok: false,
      error: "model_unavailable",
      message: "Prediction is unavailable right now. Please try again.",
    };
  }

  try {
    const conditions = parsePredictionResponse(raw);
    return {
      ok: true,
      data: { conditions, model, promptVersion: PREDICTION_PROMPT_VERSION },
    };
  } catch {
    return {
      ok: false,
      error: "model_output_invalid",
      message: "The model returned an unusable result. Please try again.",
    };
  }
}
