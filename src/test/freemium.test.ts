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

  it("allows Graphing, Equation Solver, and Converter during initial 2 trial days, but blocks them on the 3rd day while keeping calculator unlimited", () => {
    // Within initial trial (Day 1)
    localStorage.setItem("activeDays", JSON.stringify(["Mon Jan 01 2024"]));
    expect(canAccessPremiumFeature("calculator", false)).toBe(true);
    expect(canAccessPremiumFeature("graph", false)).toBe(true);
    expect(canAccessPremiumFeature("equation", false)).toBe(true);
    expect(canAccessPremiumFeature("converter", false)).toBe(true);

    // Within initial trial (Day 2)
    localStorage.setItem("activeDays", JSON.stringify(["Mon Jan 01 2024", "Tue Jan 02 2024"]));
    expect(canAccessPremiumFeature("calculator", false)).toBe(true);
    expect(canAccessPremiumFeature("graph", false)).toBe(true);
    expect(canAccessPremiumFeature("equation", false)).toBe(true);
    expect(canAccessPremiumFeature("converter", false)).toBe(true);

    // On the 3rd day (3 active days)
    localStorage.setItem(
      "activeDays",
      JSON.stringify(["Mon Jan 01 2024", "Tue Jan 02 2024", "Wed Jan 03 2024"])
    );
    // Calculator calculation remains permanently unlimited!
    expect(canAccessPremiumFeature("calculator", false)).toBe(true);

    // History and advanced features are locked on the 3rd day until paid
    expect(canSaveHistory(false)).toBe(false);
    expect(canAccessPremiumFeature("history", false)).toBe(false);
    expect(canAccessPremiumFeature("history_pdf", false)).toBe(false);
    expect(canAccessPremiumFeature("graph", false)).toBe(false);
    expect(canAccessPremiumFeature("equation", false)).toBe(false);
    expect(canAccessPremiumFeature("converter", false)).toBe(false);

    // All unlocked once paid
    expect(canSaveHistory(true)).toBe(true);
    expect(canAccessPremiumFeature("history", true)).toBe(true);
    expect(canAccessPremiumFeature("history_pdf", true)).toBe(true);
    expect(canAccessPremiumFeature("graph", true)).toBe(true);
    expect(canAccessPremiumFeature("equation", true)).toBe(true);
    expect(canAccessPremiumFeature("converter", true)).toBe(true);
  });
});
