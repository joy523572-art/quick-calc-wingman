import { beforeEach, describe, expect, it } from "vitest";
import { canSaveHistory, canAccessPremiumFeature, PREMIUM_FEATURES, UNLOCKED_FREE_FEATURES } from "@/lib/freemium";
import { saveFirstOpenTimestamp } from "@/lib/trialManager";

describe("Permanently Unlocked & Premium Feature Access", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    document.cookie = "nume_first_open_timestamp=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
  });

  it.each(UNLOCKED_FREE_FEATURES)("permanently unlocks %s for all users at all times", (feature) => {
    const expiredTimestamp = Date.now() - 8 * 24 * 60 * 60 * 1000;
    saveFirstOpenTimestamp(expiredTimestamp);
    expect(canAccessPremiumFeature(feature, false)).toBe(true);
    expect(canAccessPremiumFeature(feature, true)).toBe(true);
  });

  it.each(PREMIUM_FEATURES)("requires Lifetime PRO for %s after trial expires", (feature) => {
    const expiredTimestamp = Date.now() - 8 * 24 * 60 * 60 * 1000;
    saveFirstOpenTimestamp(expiredTimestamp);
    expect(canAccessPremiumFeature(feature, false)).toBe(false);
    expect(canAccessPremiumFeature(feature, true)).toBe(true);
  });

  it("allows Graphing, Equation Solver, and Converter during 3-day free trial, but blocks them after trial expires while keeping calculator unlimited", () => {
    // Within 3-day trial
    localStorage.setItem("activeDays", JSON.stringify(["Mon Jan 01 2024"]));
    expect(canAccessPremiumFeature("calculator", false)).toBe(true);
    expect(canAccessPremiumFeature("graph", false)).toBe(true);
    expect(canAccessPremiumFeature("equation", false)).toBe(true);
    expect(canAccessPremiumFeature("converter", false)).toBe(true);

    // After 3 distinct days trial has exhausted (4 active days)
    localStorage.setItem(
      "activeDays",
      JSON.stringify(["Mon Jan 01 2024", "Tue Jan 02 2024", "Wed Jan 03 2024", "Thu Jan 04 2024"])
    );
    // Calculator remains unlimited!
    expect(canAccessPremiumFeature("calculator", false)).toBe(true);
    expect(canSaveHistory(false)).toBe(true);

    // Graphing, Equation Solver, and Converter are blocked until paid
    expect(canAccessPremiumFeature("graph", false)).toBe(false);
    expect(canAccessPremiumFeature("equation", false)).toBe(false);
    expect(canAccessPremiumFeature("converter", false)).toBe(false);

    // Unlocked once paid
    expect(canAccessPremiumFeature("graph", true)).toBe(true);
    expect(canAccessPremiumFeature("equation", true)).toBe(true);
    expect(canAccessPremiumFeature("converter", true)).toBe(true);
  });
});
