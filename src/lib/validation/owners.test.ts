import { describe, it, expect } from "vitest";
import {
  ownerCreateSchema,
  ownerUpdateSchema,
  registerClientSchema,
} from "@/lib/validation/owners";

describe("ownerCreateSchema", () => {
  it("accepts a name-only owner (contact fields optional)", () => {
    const r = ownerCreateSchema.safeParse({ full_name: "Maria Santos" });
    expect(r.success).toBe(true);
  });

  it("requires a non-empty name", () => {
    expect(ownerCreateSchema.safeParse({ full_name: "  " }).success).toBe(false);
  });

  it("treats empty contact strings as omitted, not invalid", () => {
    const r = ownerCreateSchema.safeParse({
      full_name: "Juan",
      email: "",
      phone: "",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBeUndefined();
  });

  it("rejects a malformed email when one is given", () => {
    expect(
      ownerCreateSchema.safeParse({ full_name: "Juan", email: "nope" }).success,
    ).toBe(false);
  });
});

describe("ownerUpdateSchema", () => {
  const id = "550e8400-e29b-41d4-a716-446655440000";

  it("requires a uuid id", () => {
    expect(
      ownerUpdateSchema.safeParse({ full_name: "X", id: "not-a-uuid" }).success,
    ).toBe(false);
    expect(ownerUpdateSchema.safeParse({ id, full_name: "X" }).success).toBe(
      true,
    );
  });

  it("maps a cleared optional field to null (not undefined) so it persists", () => {
    const r = ownerUpdateSchema.safeParse({ id, phone: "", email: "" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.phone).toBeNull();
      expect(r.data.email).toBeNull();
    }
  });
});

describe("registerClientSchema", () => {
  const owner = { full_name: "Maria Santos" };

  it("accepts an owner-only registration when skipPet is true", () => {
    const r = registerClientSchema.safeParse({ owner, skipPet: true });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.pet).toBeUndefined();
  });

  it("rejects a missing pet section when skipPet is not set", () => {
    const r = registerClientSchema.safeParse({ owner });
    expect(r.success).toBe(false);
  });

  it("rejects a missing pet section when skipPet is explicitly false", () => {
    const r = registerClientSchema.safeParse({ owner, skipPet: false });
    expect(r.success).toBe(false);
  });

  it("rejects a pet section missing its required name", () => {
    const r = registerClientSchema.safeParse({
      owner,
      pet: { species: "Dog" },
    });
    expect(r.success).toBe(false);
  });

  it("rejects a pet section missing its required species", () => {
    const r = registerClientSchema.safeParse({
      owner,
      pet: { name: "Fido" },
    });
    expect(r.success).toBe(false);
  });

  it("accepts a full owner + pet registration and coerces weight", () => {
    const r = registerClientSchema.safeParse({
      owner: { ...owner, email: "maria@example.com" },
      pet: {
        name: "Fido",
        species: "Dog",
        breed: "",
        sex: "",
        date_of_birth: "",
        weight_kg: "12.5",
        notes: "",
      },
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.pet?.breed).toBeUndefined();
      expect(r.data.pet?.sex).toBeUndefined();
      expect(r.data.pet?.date_of_birth).toBeUndefined();
      expect(r.data.pet?.weight_kg).toBe(12.5);
    }
  });
});
