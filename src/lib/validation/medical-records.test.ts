import { describe, it, expect } from "vitest";
import {
  medicalRecordCreateSchema,
  medicalRecordUpdateSchema,
} from "@/lib/validation/medical-records";

const petId = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
const recId = "550e8400-e29b-41d4-a716-446655440000";

describe("medicalRecordCreateSchema", () => {
  it("accepts a minimal intake record (pet only)", () => {
    expect(medicalRecordCreateSchema.safeParse({ pet_id: petId }).success).toBe(
      true,
    );
  });

  it("requires a valid pet_id", () => {
    expect(
      medicalRecordCreateSchema.safeParse({ pet_id: "nope" }).success,
    ).toBe(false);
  });

  it("coerces intake vitals and validates ranges", () => {
    const r = medicalRecordCreateSchema.safeParse({
      pet_id: petId,
      intake_weight_kg: "10.4",
      intake_temp_c: "38.6",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.intake_weight_kg).toBe(10.4);
      expect(r.data.intake_temp_c).toBe(38.6);
    }
    expect(
      medicalRecordCreateSchema.safeParse({
        pet_id: petId,
        intake_temp_c: "999",
      }).success,
    ).toBe(false);
  });

  it("rejects a malformed visit_date", () => {
    expect(
      medicalRecordCreateSchema.safeParse({
        pet_id: petId,
        visit_date: "07-08-2026",
      }).success,
    ).toBe(false);
  });

  it("accepts an optional prediction_id linking an AI prediction run", () => {
    const predictionId = "3fa85f64-5717-4562-b3fc-2c963f66afa6";
    const r = medicalRecordCreateSchema.safeParse({
      pet_id: petId,
      prediction_id: predictionId,
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.prediction_id).toBe(predictionId);
  });

  it("treats a missing prediction_id as undefined, not required", () => {
    const r = medicalRecordCreateSchema.safeParse({ pet_id: petId });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.prediction_id).toBeUndefined();
  });

  it("rejects a malformed prediction_id", () => {
    expect(
      medicalRecordCreateSchema.safeParse({
        pet_id: petId,
        prediction_id: "not-a-uuid",
      }).success,
    ).toBe(false);
  });

  it("accepts an opt-in sync_pet_weight flag", () => {
    const r = medicalRecordCreateSchema.safeParse({
      pet_id: petId,
      intake_weight_kg: "12.3",
      sync_pet_weight: true,
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.sync_pet_weight).toBe(true);
  });
});

describe("medicalRecordUpdateSchema", () => {
  it("clears a clinical field to null (persists the clear)", () => {
    const r = medicalRecordUpdateSchema.safeParse({ id: recId, plan: "" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.plan).toBeNull();
  });

  it("accepts an opt-in sync_pet_weight flag", () => {
    const r = medicalRecordUpdateSchema.safeParse({
      id: recId,
      sync_pet_weight: true,
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.sync_pet_weight).toBe(true);
  });
});
