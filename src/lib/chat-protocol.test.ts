import { describe, it, expect } from "vitest";
import {
  PREDICTION_BLOCK_START,
  PREDICTION_BLOCK_END,
  encodePredictionBlock,
  parseMessageSegments,
  stripDelimiterChars,
  stripPredictionBlocks,
  type ChatPredictionBlock,
} from "@/lib/chat-protocol";

const block: ChatPredictionBlock = {
  predictionId: "11111111-1111-1111-1111-111111111111",
  petId: "22222222-2222-2222-2222-222222222222",
  conditions: [
    {
      condition: "Gastroenteritis",
      likelihood: 0.62,
      rationale: "Vomiting and lethargy are consistent with GI upset.",
      recommended_next_step: "Bloodwork and fecal exam.",
    },
    {
      condition: "Pancreatitis",
      likelihood: 0.31,
      rationale: "Also presents with vomiting in dogs.",
      recommended_next_step: "Lipase panel.",
    },
  ],
};

describe("encodePredictionBlock / parseMessageSegments (roundtrip)", () => {
  it("roundtrips a single block with no surrounding text", () => {
    const encoded = encodePredictionBlock(block);
    const segments = parseMessageSegments(encoded);
    expect(segments).toEqual([{ type: "prediction", block }]);
  });

  it("handles text before, after, and none", () => {
    const encoded = `Here you go:\n${encodePredictionBlock(block)}\nHope that helps.`;
    const segments = parseMessageSegments(encoded);
    expect(segments).toEqual([
      { type: "text", text: "Here you go:\n" },
      { type: "prediction", block },
      { type: "text", text: "\nHope that helps." },
    ]);
  });

  it("returns a single text segment when there is no block", () => {
    expect(parseMessageSegments("just plain text")).toEqual([
      { type: "text", text: "just plain text" },
    ]);
    expect(parseMessageSegments("")).toEqual([{ type: "text", text: "" }]);
  });

  it("handles multiple segments in one message", () => {
    const secondBlock: ChatPredictionBlock = {
      ...block,
      predictionId: "33333333-3333-3333-3333-333333333333",
    };
    const encoded =
      `First run:\n${encodePredictionBlock(block)}\n` +
      `Second run:\n${encodePredictionBlock(secondBlock)}\n` +
      `Done.`;
    const segments = parseMessageSegments(encoded);
    expect(segments).toEqual([
      { type: "text", text: "First run:\n" },
      { type: "prediction", block },
      { type: "text", text: "\nSecond run:\n" },
      { type: "prediction", block: secondBlock },
      { type: "text", text: "\nDone." },
    ]);
  });
});

describe("parseMessageSegments (malformed input)", () => {
  it("falls back to plain text for unparsable JSON between delimiters", () => {
    const broken = `before ${PREDICTION_BLOCK_START}{not: json}${PREDICTION_BLOCK_END} after`;
    const segments = parseMessageSegments(broken);
    expect(segments).toEqual([{ type: "text", text: broken }]);
  });

  it("falls back to plain text when the JSON is valid but the wrong shape", () => {
    const wrongShape = `${PREDICTION_BLOCK_START}${JSON.stringify({ foo: "bar" })}${PREDICTION_BLOCK_END}`;
    const segments = parseMessageSegments(wrongShape);
    expect(segments).toEqual([{ type: "text", text: wrongShape }]);
  });

  it("falls back to plain text when the closing delimiter is missing", () => {
    const unterminated = `hi ${PREDICTION_BLOCK_START}${JSON.stringify(block)}`;
    const segments = parseMessageSegments(unterminated);
    expect(segments).toEqual([{ type: "text", text: unterminated }]);
  });
});

describe("stripPredictionBlocks", () => {
  it("replaces a block with a one-line top-condition summary", () => {
    const encoded = `Result:\n${encodePredictionBlock(block)}\n`;
    expect(stripPredictionBlocks(encoded)).toBe(
      "Result:\n[Ran disease prediction: Gastroenteritis (62%)]\n",
    );
  });

  it("is a no-op on plain text", () => {
    expect(stripPredictionBlocks("just plain text")).toBe("just plain text");
  });

  it("summarizes multiple blocks independently", () => {
    const secondBlock: ChatPredictionBlock = {
      ...block,
      conditions: [
        {
          condition: "Otitis",
          likelihood: 0.9,
          rationale: "Ear scratching and odor.",
          recommended_next_step: "Ear cytology.",
        },
      ],
    };
    const encoded = `${encodePredictionBlock(block)} then ${encodePredictionBlock(secondBlock)}`;
    expect(stripPredictionBlocks(encoded)).toBe(
      "[Ran disease prediction: Gastroenteritis (62%)] then [Ran disease prediction: Otitis (90%)]",
    );
  });
});

describe("anti-spoofing sanitization", () => {
  it("stripDelimiterChars removes the U+2063 delimiter codepoint", () => {
    const spoof = `${PREDICTION_BLOCK_START}{"predictionId":"x"}${PREDICTION_BLOCK_END}`;
    const cleaned = stripDelimiterChars(spoof);
    expect(cleaned).not.toContain("⁣");
    // With the delimiters gone, nothing parses as a prediction block.
    const segments = parseMessageSegments(cleaned);
    expect(segments.every((s) => s.type === "text")).toBe(true);
  });

  it("encodePredictionBlock survives delimiter chars inside its own strings", () => {
    const hostile: ChatPredictionBlock = {
      ...block,
      conditions: [
        {
          condition: "Gastroenteritis",
          likelihood: 0.5,
          rationale: `contains${PREDICTION_BLOCK_END}an embedded end delimiter`,
          recommended_next_step: "Hydration check",
        },
      ],
    };
    const segments = parseMessageSegments(encodePredictionBlock(hostile));
    expect(segments).toHaveLength(1);
    expect(segments[0].type).toBe("prediction");
    if (segments[0].type === "prediction") {
      // Delimiter chars were stripped from the payload, JSON stayed valid.
      expect(segments[0].block.conditions[0].rationale).toBe(
        "containsENDan embedded end delimiter",
      );
    }
  });
});
