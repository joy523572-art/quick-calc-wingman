import { beforeEach, describe, expect, it } from "vitest";
import {
  canSaveHistory,
  canToggleNetwork,
  canAccessPremiumFeature,
  PREMIUM_FEATURES,
  UNLOCKED_FREE_FEATURES,
} from "@/lib/freemium";
import {
  consumeFeatureTrial,
  resetAllFeatureTrials,
  exhaustAllFeatureTrials,
  getMaxFeatureTrials,
  getFeatureTrialCount,
} from "@/lib/trialManager";

describe("Permanently Unlocked & Lifetime Trial Access", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    resetAllFeatureTrials();
  });

  it.each(UNLOCKED_FREE_FEATURES)(
    "permanently unlocks %s for all users at all times without limits",
    (feature) => {
      exhaustAllFeatureTrials();
      expect(canAccessPremiumFeature(feature, false)).toBe(true);
      expect(canAccessPremiumFeature(feature, true)).toBe(true);
    }
  );

  it("never locks Online/Offline toggle", () => {
    exhaustAllFeatureTrials();
    expect(canToggleNetwork()).toBe(true);
    expect(canAccessPremiumFeature("network", false)).toBe(true);
  });

  it.each(PREMIUM_FEATURES)(
    "locks %s after free lifetime trials are exhausted unless subscribed",
    (feature) => {
      exhaustAllFeatureTrials();
      expect(canAccessPremiumFeature(feature, false)).toBe(false);
      expect(canAccessPremiumFeature(feature, true)).toBe(true);
    }
  );

  it("grants 4 free lifetime trials for converter and 3 for other features while keeping calculator unlimited", () => {
    expect(getMaxFeatureTrials("converter")).toBe(4);
    expect(getMaxFeatureTrials("graph")).toBe(3);
    expect(getMaxFeatureTrials("equation")).toBe(3);
    expect(getMaxFeatureTrials("history")).toBe(3);

    expect(canAccessPremiumFeature("calculator", false)).toBe(true);
    expect(canAccessPremiumFeature("converter", false)).toBe(true);
    expect(canSaveHistory(false)).toBe(true);

    // 3 converter uses: still unlocked (3/4)
    consumeFeatureTrial("converter");
    consumeFeatureTrial("converter");
    consumeFeatureTrial("converter");
    expect(canAccessPremiumFeature("converter", false)).toBe(true);

    // 4th converter use: exhausted (4/4)
    consumeFeatureTrial("converter");
    expect(canAccessPremiumFeature("converter", false)).toBe(false);

    // 3 graph uses: exhausted (3/3)
    consumeFeatureTrial("graph");
    consumeFeatureTrial("graph");
    expect(canAccessPremiumFeature("graph", false)).toBe(true);
    consumeFeatureTrial("graph");
    expect(canAccessPremiumFeature("graph", false)).toBe(false);

    // Calculator and network remain permanently free
    expect(canAccessPremiumFeature("calculator", false)).toBe(true);
    expect(canAccessPremiumFeature("network", false)).toBe(true);

    // Subscribed users regain full access
    expect(canAccessPremiumFeature("converter", true)).toBe(true);
    expect(canAccessPremiumFeature("graph", true)).toBe(true);
  });

  it("does not expire or reset trial counts based on 24h or 3-day timestamps", () => {
    consumeFeatureTrial("graph");
    consumeFeatureTrial("graph");
    consumeFeatureTrial("graph");
    // Simulate legacy timestamp from days ago
    localStorage.setItem("nume.trial_timestamp.graph", String(Date.now() - 5 * 24 * 60 * 60 * 1000));
    expect(getFeatureTrialCount("graph")).toBe(3);
    expect(canAccessPremiumFeature("graph", false)).toBe(false);
  });

  it("keeps equation solver locked after 3 uses even when equation_pdf and history_pdf free trials are unused", async () => {
    const { hasFeatureFreeTrials, getFeatureRemainingTrials } = await import("@/lib/trialManager");

    expect(getFeatureRemainingTrials("equation_pdf", false)).toBe(3);
    expect(getFeatureRemainingTrials("history_pdf", false)).toBe(3);

    // Exhaust only the 3 equation solver trials (never touch PDF export)
    consumeFeatureTrial("equation");
    consumeFeatureTrial("equation");
    consumeFeatureTrial("equation");

    // PDF download still has all 3 unused free trials
    expect(getFeatureRemainingTrials("equation_pdf", false)).toBe(3);

    // Solver feature and "equations" tab MUST remain locked!
    expect(canAccessPremiumFeature("equation", false)).toBe(false);
    expect(hasFeatureFreeTrials("equation", false)).toBe(false);
    expect(hasFeatureFreeTrials("equations", false)).toBe(false);

    // PDF exports themselves also lock cleanly after 3 uses
    consumeFeatureTrial("equation_pdf");
    consumeFeatureTrial("equation_pdf");
    expect(canAccessPremiumFeature("equation_pdf", false)).toBe(true);
    consumeFeatureTrial("equation_pdf");
    expect(canAccessPremiumFeature("equation_pdf", false)).toBe(false);

    // Calculator remains permanently free
    expect(canAccessPremiumFeature("calculator", false)).toBe(true);
  });
});
