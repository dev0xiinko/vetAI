import { describe, it, expect } from "vitest";
import { petCreateSchema, petUpdateSchema } from "@/lib/validation/pets";

const ownerId = "550e8400-e29b-41d4-a716-446655440000";
const petId = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";

describe("petCreateSchema", () => {
  const base = { owner_id: ownerId, name: "Bantay", species: "Dog" };

  it("accepts a minimal pet (owner + name + species)", () => {
    expect(petCreateSchema.safeParse(base).success).toBe(true);
  });

  it("requires a valid owner_id", () => {
    expect(
      petCreateSchema.safeParse({ ...base, owner_id: "nope" }).success,
    ).toBe(false);
  });

  it("requires name and species", () => {
    expect(petCreateSchema.safeParse({ ...base, name: " " }).success).toBe(
      false,
    );
    expect(petCreateSchema.safeParse({ ...base, species: "" }).success).toBe(
      false,
    );
  });

  it("coerces weight and rejects non-positive", () => {
    const ok = petCreateSchema.safeParse({ ...base, weight_kg: "12.5" });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.weight_kg).toBe(12.5);
    expect(petCreateSchema.safeParse({ ...base, weight_kg: "0" }).success).toBe(
      false,
    );
  });

  it("validates the sex enum and date format", () => {
    expect(
      petCreateSchema.safeParse({ ...base, sex: "male" }).success,
    ).toBe(true);
    expect(
      petCreateSchema.safeParse({ ...base, sex: "alien" }).success,
    ).toBe(false);
    expect(
      petCreateSchema.safeParse({ ...base, date_of_birth: "2020/01/01" })
        .success,
    ).toBe(false);
  });
});

describe("petUpdateSchema", () => {
  it("clears an optional field to null (persists the clear)", () => {
    const r = petUpdateSchema.safeParse({ id: petId, breed: "", weight_kg: "" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.breed).toBeNull();
      expect(r.data.weight_kg).toBeNull();
    }
  });
});
