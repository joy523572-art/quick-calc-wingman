import { beforeEach, describe, expect, it, vi } from "vitest";
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

  it("grants a one-time 1-hour Equation Solver test permission when exhausted and locks back after 1 hour", async () => {
    const startTime = Date.parse("2026-11-20T16:15:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(startTime);

    try {
      const {
        maybeGrantOneHourEquationTestPass,
        isEquationTestPassActive,
        formatTrialTimeRemaining,
      } = await import("@/lib/trialManager");

      // Exhaust 3/3 Equation Solver trials and 3/3 Graph trials
      consumeFeatureTrial("equation");
      consumeFeatureTrial("equation");
      consumeFeatureTrial("equation");
      consumeFeatureTrial("graph");
      consumeFeatureTrial("graph");
      consumeFeatureTrial("graph");

      expect(canAccessPremiumFeature("equation", false)).toBe(false);
      expect(canAccessPremiumFeature("graph", false)).toBe(false);

      const granted = maybeGrantOneHourEquationTestPass(false, startTime);
      expect(granted).toBe(true);
      expect(isEquationTestPassActive("equation", startTime)).toBe(true);

      // Equation Solver is temporarily unlocked for 1 hour, while Graph remains locked
      expect(canAccessPremiumFeature("equation", false)).toBe(true);
      expect(canAccessPremiumFeature("graph", false)).toBe(false);
      expect(formatTrialTimeRemaining("equation")).toContain("Test Access");

      // Consuming Equation Solver during the 1-hour test window keeps underlying 3/3 state intact
      consumeFeatureTrial("equation");
      expect(getFeatureTrialCount("equation")).toBe(3);

      // After 1 hour (61 minutes later), Equation Solver automatically locks back to 3/3
      vi.advanceTimersByTime(61 * 60 * 1000);
      const expiredTime = Date.now();
      expect(isEquationTestPassActive("equation", expiredTime)).toBe(false);
      expect(canAccessPremiumFeature("equation", false)).toBe(false);
      expect(getFeatureTrialCount("equation")).toBe(3);

      // Must NOT grant again once the one-time pass has been used
      expect(maybeGrantOneHourEquationTestPass(false, expiredTime)).toBe(false);
      expect(canAccessPremiumFeature("equation", false)).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});
