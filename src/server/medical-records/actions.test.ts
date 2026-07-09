import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the boundary modules so the action runs against a fake Supabase.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({
  requireSession: vi.fn(async () => ({
    userId: "00000000-0000-0000-0000-00000000aaaa",
    role: "veterinarian",
    fullName: "Test Vet",
  })),
}));

type PredictionRow = { id: string; pet_id: string | null } | null;

const state: {
  predictionRow: PredictionRow;
  capturedInsert: Record<string, unknown> | null;
} = { predictionRow: null, capturedInsert: null };

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from(table: string) {
      if (table === "predictions") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: state.predictionRow }),
            }),
          }),
        };
      }
      if (table === "medical_records") {
        return {
          insert: (row: Record<string, unknown>) => {
            state.capturedInsert = row;
            return {
              select: () => ({
                single: async () => ({ data: { id: "rec-1" }, error: null }),
              }),
            };
          },
        };
      }
      if (table === "pets") {
        return {
          update: () => ({ eq: async () => ({ error: null }) }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  })),
}));

import { createMedicalRecord } from "@/server/medical-records/actions";

const petA = "550e8400-e29b-41d4-a716-446655440000";
const petB = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
const predX = "3fa85f64-5717-4562-b3fc-2c963f66afa6";

beforeEach(() => {
  state.predictionRow = null;
  state.capturedInsert = null;
});

describe("createMedicalRecord prediction-link integrity", () => {
  it("links the prediction when it belongs to the record's pet", async () => {
    state.predictionRow = { id: predX, pet_id: petA };
    const res = await createMedicalRecord({ pet_id: petA, prediction_id: predX });
    expect(res.ok).toBe(true);
    expect(state.capturedInsert?.prediction_id).toBe(predX);
  });

  it("nulls the link when the prediction belongs to a DIFFERENT pet", async () => {
    state.predictionRow = { id: predX, pet_id: petB };
    const res = await createMedicalRecord({ pet_id: petA, prediction_id: predX });
    expect(res.ok).toBe(true); // record still saves —
    expect(state.capturedInsert?.prediction_id).toBeNull(); // — but unlinked
  });

  it("nulls the link when the prediction has no pet", async () => {
    state.predictionRow = { id: predX, pet_id: null };
    await createMedicalRecord({ pet_id: petA, prediction_id: predX });
    expect(state.capturedInsert?.prediction_id).toBeNull();
  });

  it("nulls the link when the prediction row is not visible/absent", async () => {
    state.predictionRow = null;
    await createMedicalRecord({ pet_id: petA, prediction_id: predX });
    expect(state.capturedInsert?.prediction_id).toBeNull();
  });
});
