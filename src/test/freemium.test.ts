import { describe, expect, it } from "vitest";
import { canSaveHistory, canAccessPremiumFeature, PREMIUM_FEATURES } from "@/lib/freemium";

describe("Premium-only access", () => {
  it.each(PREMIUM_FEATURES)("requires PRO immediately for %s, with no free uses", (feature) => {
    expect(canAccessPremiumFeature(feature, false)).toBe(false);
    expect(canAccessPremiumFeature(feature, true)).toBe(true);
    expect(canAccessPremiumFeature(feature, false)).toBe(false);
  });

  it("history saving is Premium only", () => {
    expect(canSaveHistory(false)).toBe(false);
    expect(canSaveHistory(true)).toBe(true);
  });
});
