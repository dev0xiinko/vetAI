import "server-only";
import { getOpenAIClient, DEFAULT_MODEL } from "@/lib/ai/openai";
import { stripDelimiterChars } from "@/lib/chat-protocol";
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources/chat/completions";

/**
 * Stream assistant response deltas for a scoped chat. Rules stay in the system
 * message (injection boundary); output is text to display, never a trigger for
 * privileged actions. Callers persist the accumulated text. Wrap in try/catch —
 * a model outage must degrade gracefully, not crash the request.
 */
const STREAM_TIMEOUT_MS = 30_000;

export async function* streamChatDeltas(
  messages: ChatCompletionMessageParam[],
  opts: { model?: string; signal?: AbortSignal } = {},
): AsyncGenerator<string> {
  const client = getOpenAIClient();
  const stream = await client.chat.completions.create(
    {
      model: opts.model ?? DEFAULT_MODEL,
      messages,
      stream: true,
      temperature: 0.3,
    },
    // Bound a hung upstream connection so it degrades to the fallback, not a
    // request that hangs open (ai-features.md: timeout every model call).
    { signal: opts.signal ?? AbortSignal.timeout(STREAM_TIMEOUT_MS) },
  );

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    // Strip the prediction-block delimiter from MODEL text: only the route's
    // own encodePredictionBlock output may ever carry it (anti-spoofing).
    const clean = delta ? stripDelimiterChars(delta) : "";
    if (clean) yield clean;
  }
}

export type ChatStreamEvent =
  | { type: "text"; delta: string }
  | { type: "tool_call"; id: string; name: string; args: string };

/**
 * Stream a chat completion that may call ONE tool (bound cost: at most one
 * tool call handled per request — see route.ts). Accumulates streamed
 * tool-call argument fragments and emits a single `tool_call` event once the
 * stream finishes with `finish_reason: "tool_calls"`. Only the first tool
 * call (index 0) is tracked; `parallel_tool_calls` is also disabled so the
 * model itself is asked for at most one.
 *
 * The caller MUST treat `args` as untrusted model output and validate it
 * (e.g. with a zod schema) before acting on it.
 */
export async function* streamChatWithTools(
  messages: ChatCompletionMessageParam[],
  opts: {
    model?: string;
    tools?: ChatCompletionTool[];
    signal?: AbortSignal;
  } = {},
): AsyncGenerator<ChatStreamEvent> {
  const client = getOpenAIClient();
  const hasTools = !!opts.tools && opts.tools.length > 0;
  const stream = await client.chat.completions.create(
    {
      model: opts.model ?? DEFAULT_MODEL,
      messages,
      stream: true,
      temperature: 0.3,
      ...(hasTools
        ? {
            tools: opts.tools,
            tool_choice: "auto" as const,
            parallel_tool_calls: false,
          }
        : {}),
    },
    { signal: opts.signal ?? AbortSignal.timeout(STREAM_TIMEOUT_MS) },
  );

  let toolCallId: string | undefined;
  let toolCallName: string | undefined;
  let toolCallArgs = "";
  let sawToolCall = false;

  for await (const chunk of stream) {
    const choice = chunk.choices[0];
    const delta = choice?.delta;

    if (delta?.content) {
      // Same anti-spoofing rule as streamChatDeltas: model text can never
      // contain the prediction-block delimiter.
      const clean = stripDelimiterChars(delta.content);
      if (clean) yield { type: "text", delta: clean };
    }

    const toolCalls = delta?.tool_calls;
    if (toolCalls && toolCalls.length > 0) {
      // Only track the FIRST tool call — the app bounds cost to one tool
      // call per user message.
      const call = toolCalls.find((c) => c.index === 0) ?? toolCalls[0];
      if (call) {
        sawToolCall = true;
        if (call.id) toolCallId = call.id;
        if (call.function?.name) toolCallName = call.function.name;
        if (call.function?.arguments) toolCallArgs += call.function.arguments;
      }
    }

    if (choice?.finish_reason === "tool_calls" && sawToolCall && toolCallName) {
      yield {
        type: "tool_call",
        id: toolCallId ?? "",
        name: toolCallName,
        args: toolCallArgs,
      };
    }
  }
}
