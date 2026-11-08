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

  it("permanently allows history saving for all users", () => {
    const expiredTimestamp = Date.now() - 8 * 24 * 60 * 60 * 1000;
    saveFirstOpenTimestamp(expiredTimestamp);
    expect(canSaveHistory(false)).toBe(true);
    expect(canSaveHistory(true)).toBe(true);
  });
});
