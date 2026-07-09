import "server-only";
import OpenAI from "openai";
import { requireServerEnv } from "@/lib/env";

/**
 * The single LLM client for the app. We use OpenRouter (an OpenAI-compatible
 * gateway) via the OpenAI SDK — just a different baseURL + key. Swapping the
 * model slug (below) is all it takes to change providers.
 *
 * Key is server-only (never a NEXT_PUBLIC_ var, never logged, never in a client
 * bundle). Lazily created so importing this module doesn't require the key until
 * a call is actually made.
 */
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

let client: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (!client) {
    // Optional attribution headers OpenRouter uses for its dashboards/rankings.
    const defaultHeaders: Record<string, string> = {};
    if (process.env.OPENROUTER_SITE_URL) {
      defaultHeaders["HTTP-Referer"] = process.env.OPENROUTER_SITE_URL;
    }
    if (process.env.OPENROUTER_APP_NAME) {
      defaultHeaders["X-Title"] = process.env.OPENROUTER_APP_NAME;
    }

    client = new OpenAI({
      apiKey: requireServerEnv("OPENROUTER_API_KEY"),
      baseURL: OPENROUTER_BASE_URL,
      defaultHeaders,
    });
  }
  return client;
}

/**
 * Default model for structured prediction/chat calls, as an OpenRouter slug
 * (`vendor/model`). Override via OPENROUTER_MODEL without a code change.
 */
export const DEFAULT_MODEL =
  process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini";
