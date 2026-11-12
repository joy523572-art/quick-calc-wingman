import { beforeEach, describe, expect, it } from "vitest";
import { canSaveHistory, canAccessPremiumFeature, PREMIUM_FEATURES, UNLOCKED_FREE_FEATURES } from "@/lib/freemium";
import { consumeFeatureTrial, resetAllFeatureTrials, exhaustAllFeatureTrials, getMaxFeatureTrials } from "@/lib/trialManager";

describe("Permanently Unlocked & Free Trial Uses Access", () => {
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

  it.each(PREMIUM_FEATURES)("requires Lifetime PRO for %s after free trial uses are exhausted", (feature) => {
    exhaustAllFeatureTrials();
    expect(canAccessPremiumFeature(feature, false)).toBe(false);
    expect(canAccessPremiumFeature(feature, true)).toBe(true);
  });

  it("grants 4 free trial uses for converter and 2 for other premium features while keeping scientific calculator unlimited", () => {
    expect(getMaxFeatureTrials("converter")).toBe(4);
    expect(getMaxFeatureTrials("graph")).toBe(2);
    expect(getMaxFeatureTrials("equation")).toBe(2);

    // 0 uses: allowed
    expect(canAccessPremiumFeature("calculator", false)).toBe(true);
    expect(canAccessPremiumFeature("converter", false)).toBe(true);

    // Use converter 3 times (3/4): still allowed
    consumeFeatureTrial("converter");
    consumeFeatureTrial("converter");
    consumeFeatureTrial("converter");
    expect(canAccessPremiumFeature("converter", false)).toBe(true);

    // Use converter 4th time (4/4): locked
    consumeFeatureTrial("converter");
    expect(canAccessPremiumFeature("converter", false)).toBe(false);

    // Calculator remains permanently free and unlimited!
    expect(canAccessPremiumFeature("calculator", false)).toBe(true);

    // Unlocked once Lifetime PRO is purchased
    expect(canAccessPremiumFeature("converter", true)).toBe(true);
  });
});
