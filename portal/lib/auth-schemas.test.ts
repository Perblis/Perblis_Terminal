// zod↔DRF parity (wave-7.md §Mandatory): phone normalization mirrors
// accounts' normalize_ng_phone; password mirrors validate_password_policy.
import { describe, expect, it } from "vitest";

import { normalizeNgPhone, passwordSchema, phoneSchema, registerSchema } from "./auth-schemas";

describe("normalizeNgPhone", () => {
  it.each([
    ["0803 123 4567", "+2348031234567"],
    ["08031234567", "+2348031234567"],
    ["2348031234567", "+2348031234567"],
    ["+2348031234567", "+2348031234567"],
    ["0803-123-4567", "+2348031234567"],
  ])("%s → %s", (input, expected) => {
    expect(normalizeNgPhone(input)).toBe(expected);
  });

  it("rejects non-Nigerian shapes with the 09 §1 fix-naming message", () => {
    const result = phoneSchema.safeParse("12345");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain("0803 123 4567");
    }
  });
});

describe("passwordSchema (mirrors validate_password_policy)", () => {
  it.each(["short1A", "alllowercase1", "NoDigitsHere"])("rejects %s", (pw) => {
    expect(passwordSchema.safeParse(pw).success).toBe(false);
  });

  it("accepts a compliant password", () => {
    expect(passwordSchema.safeParse("Sufficient1").success).toBe(true);
  });
});

describe("registerSchema", () => {
  it("requires both consents (DRF validate parity)", () => {
    const base = {
      full_name: "Adaeze Okafor",
      email: "a@example.com",
      phone: "08031234567",
      password: "Sufficient1",
      accept_tos: true,
      accept_privacy: false,
    };
    expect(registerSchema.safeParse(base).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, accept_privacy: true }).success).toBe(true);
  });
});
