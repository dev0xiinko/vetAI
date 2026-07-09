import { describe, it, expect, vi } from "vitest";
import {
  parsePredictionResponse,
  predictDisease,
  type ModelCaller,
} from "@/lib/ai/prediction";

const twoConditions = JSON.stringify({
  conditions: [
    {
      condition: "Gastroenteritis",
      likelihood: 0.55,
      rationale: "Acute vomiting",
      recommended_next_step: "Assess hydration",
    },
    {
      condition: "Dietary indiscretion",
      likelihood: 0.8,
      rationale: "Common in young animals",
      recommended_next_step: "Diet history",
    },
  ],
});

const validInput = { species: "dog", ageMonths: 12, symptoms: ["vomiting"] };

describe("parsePredictionResponse", () => {
  it("parses a valid response and sorts by likelihood, highest first", () => {
    const conditions = parsePredictionResponse(twoConditions);
    expect(conditions).toHaveLength(2);
    expect(conditions[0].likelihood).toBeGreaterThanOrEqual(
      conditions[1].likelihood,
    );
    expect(conditions[0].condition).toBe("Dietary indiscretion");
  });

  it("accepts a bare array as well as a { conditions } envelope", () => {
    const parsed = JSON.parse(twoConditions);
    const bare = JSON.stringify(parsed.conditions);
    expect(parsePredictionResponse(bare)).toHaveLength(2);
  });

  it("throws on non-JSON output (never renders raw model text as data)", () => {
    expect(() => parsePredictionResponse("not json")).toThrow();
  });

  it("throws on a single over-confident answer", () => {
    const single = JSON.stringify({
      conditions: [JSON.parse(twoConditions).conditions[0]],
    });
    expect(() => parsePredictionResponse(single)).toThrow();
  });
});

describe("predictDisease (orchestrator, mocked model)", () => {
  it("returns ok with parsed conditions on a good call", async () => {
    const call: ModelCaller = vi.fn().mockResolvedValue(twoConditions);
    const result = await predictDisease(validInput, { call });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.conditions).toHaveLength(2);
      expect(result.data.promptVersion).toBe("prediction-v1");
    }
    expect(call).toHaveBeenCalledOnce();
  });

  it("rejects invalid input before ever calling the model", async () => {
    const call: ModelCaller = vi.fn();
    const result = await predictDisease({ species: "" }, { call });
    expect(result).toMatchObject({ ok: false, error: "invalid_input" });
    expect(call).not.toHaveBeenCalled();
  });

  it("maps malformed model output to model_output_invalid", async () => {
    const call: ModelCaller = vi.fn().mockResolvedValue("garbage");
    const result = await predictDisease(validInput, { call });
    expect(result).toMatchObject({ ok: false, error: "model_output_invalid" });
  });

  it("degrades gracefully when the model call throws", async () => {
    const call: ModelCaller = vi
      .fn()
      .mockRejectedValue(new Error("rate limited"));
    const result = await predictDisease(validInput, { call });
    expect(result).toMatchObject({ ok: false, error: "model_unavailable" });
  });

  it("times out a hung model call instead of hanging the request", async () => {
    vi.useFakeTimers();
    const call: ModelCaller = () => new Promise<string>(() => {});
    const pending = predictDisease(validInput, { call });
    await vi.advanceTimersByTimeAsync(21_000);
    const result = await pending;
    expect(result).toMatchObject({ ok: false, error: "model_unavailable" });
    vi.useRealTimers();
  });
});
