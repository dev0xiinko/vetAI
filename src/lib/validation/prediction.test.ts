import { describe, it, expect } from "vitest";
import {
  predictionInputSchema,
  predictionOutputSchema,
} from "@/lib/validation/prediction";

describe("predictionInputSchema", () => {
  const valid = { species: "dog", ageMonths: 36, symptoms: ["vomiting"] };

  it("accepts a valid minimal input", () => {
    expect(predictionInputSchema.safeParse(valid).success).toBe(true);
  });

  it("trims and requires at least one symptom", () => {
    expect(
      predictionInputSchema.safeParse({ ...valid, symptoms: [] }).success,
    ).toBe(false);
  });

  it("rejects empty species", () => {
    expect(
      predictionInputSchema.safeParse({ ...valid, species: "" }).success,
    ).toBe(false);
  });

  it("rejects negative or non-integer age", () => {
    expect(
      predictionInputSchema.safeParse({ ...valid, ageMonths: -1 }).success,
    ).toBe(false);
    expect(
      predictionInputSchema.safeParse({ ...valid, ageMonths: 3.5 }).success,
    ).toBe(false);
  });

  it("rejects empty symptom strings", () => {
    expect(
      predictionInputSchema.safeParse({ ...valid, symptoms: ["  "] }).success,
    ).toBe(false);
  });
});

describe("predictionOutputSchema", () => {
  const cond = {
    condition: "Gastroenteritis",
    likelihood: 0.6,
    rationale: "Vomiting with acute onset",
    recommended_next_step: "Hydration status check",
  };

  it("requires at least two conditions (no single confident answer)", () => {
    expect(predictionOutputSchema.safeParse([cond]).success).toBe(false);
    expect(predictionOutputSchema.safeParse([cond, cond]).success).toBe(true);
  });

  it("rejects a likelihood outside 0..1", () => {
    expect(
      predictionOutputSchema.safeParse([cond, { ...cond, likelihood: 1.4 }])
        .success,
    ).toBe(false);
  });
});
