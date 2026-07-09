/**
 * The chatbot stream is plain text with, at most, one embedded structured
 * block carrying an in-chat prediction result. Delimiters use the Unicode
 * "invisible separator" (U+2063) so they never collide with ordinary prose,
 * markdown, or JSON the model might otherwise emit.
 */
export const PREDICTION_BLOCK_START = "⁣⁣PREDICTION⁣";
export const PREDICTION_BLOCK_END = "⁣END⁣⁣";

export type ChatPredictionBlock = {
  predictionId: string;
  petId: string;
  conditions: Array<{
    condition: string;
    likelihood: number;
    rationale: string;
    recommended_next_step: string;
  }>;
};

export type MessageSegment =
  | { type: "text"; text: string }
  | { type: "prediction"; block: ChatPredictionBlock };

/**
 * Remove the delimiter codepoint (U+2063) from a string. Applied to ALL
 * model-sourced text before it is streamed or persisted, so the only place a
 * prediction block can ever originate is the route's own encodePredictionBlock
 * call — a model coaxed into echoing the delimiters cannot spoof a card.
 */
export function stripDelimiterChars(text: string): string {
  return text.replace(/⁣/g, "");
}

/**
 * Encode a prediction result as an embeddable block for the chat stream.
 * The serialized payload is itself stripped of the delimiter codepoint so a
 * condition/rationale that somehow contains U+2063 can't truncate the block
 * (removing a char inside a JSON string keeps the JSON valid).
 */
export function encodePredictionBlock(block: ChatPredictionBlock): string {
  const payload = stripDelimiterChars(JSON.stringify(block));
  return `${PREDICTION_BLOCK_START}${payload}${PREDICTION_BLOCK_END}`;
}

function isPredictionCondition(
  value: unknown,
): value is ChatPredictionBlock["conditions"][number] {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.condition === "string" &&
    typeof v.likelihood === "number" &&
    typeof v.rationale === "string" &&
    typeof v.recommended_next_step === "string"
  );
}

function isChatPredictionBlock(value: unknown): value is ChatPredictionBlock {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.predictionId === "string" &&
    typeof v.petId === "string" &&
    Array.isArray(v.conditions) &&
    v.conditions.every(isPredictionCondition)
  );
}

/**
 * Split chat content into plain-text and prediction segments. Safe on
 * malformed input: a span between delimiters that isn't valid JSON, or
 * doesn't match the expected shape, falls back to being rendered as plain
 * text (delimiters included) instead of throwing. Handles text before,
 * after, between, or in the total absence of a block.
 */
export function parseMessageSegments(content: string): MessageSegment[] {
  const segments: MessageSegment[] = [];
  let cursor = 0;

  while (cursor < content.length) {
    const start = content.indexOf(PREDICTION_BLOCK_START, cursor);
    if (start === -1) {
      segments.push({ type: "text", text: content.slice(cursor) });
      break;
    }

    const end = content.indexOf(
      PREDICTION_BLOCK_END,
      start + PREDICTION_BLOCK_START.length,
    );
    if (end === -1) {
      // No closing delimiter — treat the remainder as plain text.
      segments.push({ type: "text", text: content.slice(cursor) });
      break;
    }

    const before = content.slice(cursor, start);
    if (before) segments.push({ type: "text", text: before });

    const raw = content.slice(start + PREDICTION_BLOCK_START.length, end);
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = undefined;
    }

    if (isChatPredictionBlock(parsed)) {
      segments.push({ type: "prediction", block: parsed });
    } else {
      // Malformed JSON / wrong shape: fall back to plain text, delimiters
      // included, rather than throwing or silently dropping content.
      segments.push({
        type: "text",
        text: content.slice(start, end + PREDICTION_BLOCK_END.length),
      });
    }

    cursor = end + PREDICTION_BLOCK_END.length;
  }

  if (segments.length === 0) segments.push({ type: "text", text: "" });
  return mergeAdjacentText(segments);
}

/** Merge consecutive text segments (e.g. a malformed block next to prose). */
function mergeAdjacentText(segments: MessageSegment[]): MessageSegment[] {
  const merged: MessageSegment[] = [];
  for (const segment of segments) {
    const last = merged[merged.length - 1];
    if (segment.type === "text" && last?.type === "text") {
      last.text += segment.text;
    } else {
      merged.push(segment);
    }
  }
  return merged;
}

/**
 * Replace each embedded prediction block with a one-line summary. Used when
 * replaying assistant history back to the model — it gets a compact record
 * of "a prediction ran" rather than a large JSON blob re-parsed as prose.
 */
export function stripPredictionBlocks(content: string): string {
  return parseMessageSegments(content)
    .map((segment) => {
      if (segment.type === "text") return segment.text;
      const top = segment.block.conditions[0];
      if (!top) return "[Ran disease prediction: no result]";
      const pct = Math.round(top.likelihood * 100);
      return `[Ran disease prediction: ${top.condition} (${pct}%)]`;
    })
    .join("");
}
