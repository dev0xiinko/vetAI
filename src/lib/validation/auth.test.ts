import { describe, it, expect } from "vitest";
import { loginSchema } from "@/lib/validation/auth";

describe("loginSchema", () => {
  it("accepts a valid email + password", () => {
    expect(
      loginSchema.safeParse({ email: "vet@clinic.ph", password: "secret" })
        .success,
    ).toBe(true);
  });

  it("trims the email", () => {
    const parsed = loginSchema.parse({
      email: "  vet@clinic.ph  ",
      password: "secret",
    });
    expect(parsed.email).toBe("vet@clinic.ph");
  });

  it("rejects a malformed email", () => {
    expect(
      loginSchema.safeParse({ email: "not-an-email", password: "secret" })
        .success,
    ).toBe(false);
  });

  it("rejects an empty password", () => {
    expect(
      loginSchema.safeParse({ email: "vet@clinic.ph", password: "" }).success,
    ).toBe(false);
  });
});
