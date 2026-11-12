import { beforeEach, describe, expect, it } from "vitest";
import { canSaveHistory, canAccessPremiumFeature, PREMIUM_FEATURES, UNLOCKED_FREE_FEATURES } from "@/lib/freemium";
import { consumeFeatureTrial, resetAllFeatureTrials, exhaustAllFeatureTrials } from "@/lib/trialManager";

describe("Permanently Unlocked & 2 Lifetime Free Trial Uses Access", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    resetAllFeatureTrials();
  });

  it.each(UNLOCKED_FREE_FEATURES)("permanently unlocks %s for all users at all times without limits", (feature) => {
    exhaustAllFeatureTrials();
    expect(canAccessPremiumFeature(feature, false)).toBe(true);
    expect(canAccessPremiumFeature(feature, true)).toBe(true);
  });

  it.each(PREMIUM_FEATURES)("requires Lifetime PRO for %s after 2 free trial uses are exhausted", (feature) => {
    exhaustAllFeatureTrials();
    expect(canAccessPremiumFeature(feature, false)).toBe(false);
    expect(canAccessPremiumFeature(feature, true)).toBe(true);
  });

  it("grants exactly 2 lifetime free trial uses for each premium feature while keeping scientific calculator unlimited", () => {
    // 0 uses: allowed
    expect(canAccessPremiumFeature("calculator", false)).toBe(true);
    expect(canAccessPremiumFeature("graph", false)).toBe(true);
    expect(canAccessPremiumFeature("equation", false)).toBe(true);
    expect(canAccessPremiumFeature("converter", false)).toBe(true);

    // Use graph once (1/2)
    consumeFeatureTrial("graph");
    expect(canAccessPremiumFeature("graph", false)).toBe(true);

    // Use graph second time (2/2)
    consumeFeatureTrial("graph");
    // Graphing now locked after 2 uses!
    expect(canAccessPremiumFeature("graph", false)).toBe(false);

    // Other features remain accessible for their own 2 free uses
    expect(canAccessPremiumFeature("equation", false)).toBe(true);
    expect(canAccessPremiumFeature("converter", false)).toBe(true);

    // Calculator remains permanently free and unlimited!
    expect(canAccessPremiumFeature("calculator", false)).toBe(true);

    // Unlocked once Lifetime PRO is purchased
    expect(canAccessPremiumFeature("graph", true)).toBe(true);
  });
});
