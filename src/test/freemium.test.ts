import { describe, expect, it } from "vitest";
import {
  canSaveFreeHistory,
  canUseFreeTrial,
  consumeDailyHistorySave,
  consumeFreeTrial,
  activateTrial,
  getTrialStatus,
  isTrialActivated,
  TRIAL_DURATION_HOURS,
  TRIAL_DURATION_MS,
  FREE_LIMITS,
  type TrialFeature,
} from "../lib/freemium";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
}

describe("free-plan limits", () => {
  it("allows exactly one history save then locks to Premium forever", () => {
    const storage = memoryStorage();
    expect(FREE_LIMITS.dailyHistorySaves).toBe(1);
    expect(canSaveFreeHistory(storage)).toBe(true);
    expect(consumeDailyHistorySave(storage)).toBe(true);
    // Locked to Premium forever after 1 save
    expect(canSaveFreeHistory(storage)).toBe(false);
    expect(consumeDailyHistorySave(storage)).toBe(false);
  });

  it("keeps all basic scientific calculator calculations unlimited", () => {
    expect(FREE_LIMITS).not.toHaveProperty("calculations");
  });

  it.each([
    "camera",
    "voice",
    "pdf",
    "copy",
    "history",
    "conversion",
    "graph",
    "equation",
  ] as const)(
    "locks %s to Premium Forever after only 1 trial",
    (feature: TrialFeature) => {
      const storage = memoryStorage();
      const t0 = 1700000000000;

      expect(isTrialActivated(feature, storage)).toBe(false);
      const initialStatus = getTrialStatus(feature, storage, t0);
      expect(initialStatus.activated).toBe(false);
      expect(initialStatus.canUse).toBe(true);
      expect(initialStatus.isLocked).toBe(false);
      expect(initialStatus.hoursRemaining).toBe(TRIAL_DURATION_HOURS);

      activateTrial(feature, storage, t0);
      expect(isTrialActivated(feature, storage)).toBe(true);

      const tPlus2h = t0 + 2 * 3600 * 1000;
      const status2h = getTrialStatus(feature, storage, tPlus2h);
      expect(status2h.activated).toBe(true);
      expect(status2h.canUse).toBe(true);
      expect(status2h.isLocked).toBe(false);
      expect(status2h.hoursRemaining).toBe(22);

      // Consume the single free trial
      expect(consumeFreeTrial(feature, storage, tPlus2h)).toBe(true);

      // Now locked to Premium forever!
      const afterUseStatus = getTrialStatus(feature, storage, tPlus2h);
      expect(afterUseStatus.canUse).toBe(false);
      expect(afterUseStatus.isLocked).toBe(true);
      expect(canUseFreeTrial(feature, storage, tPlus2h)).toBe(false);
      expect(consumeFreeTrial(feature, storage, tPlus2h)).toBe(false);
    }
  );

  it("never restarts trial countdown fresh upon app logout, re-login, or re-activation", () => {
    const storage = memoryStorage();
    const t0 = 1700000000000;

    const start1 = activateTrial("equation", storage, t0);
    expect(start1).toBe(t0);

    // Later session (simulating user logging out and back in after 8 hours)
    const tLater = t0 + 8 * 3600 * 1000;
    const start2 = activateTrial("equation", storage, tLater);
    expect(start2).toBe(t0); // Did not restart fresh

    const status = getTrialStatus("equation", storage, tLater);
    expect(status.elapsedHours).toBe(8);
    expect(status.hoursRemaining).toBe(16);
    expect(status.intervalRemainingHours).toBe(19);
  });

  it("locks feature when 24h countdown window expires even if trial wasn't consumed", () => {
    const storage = memoryStorage();
    const t0 = 1700000000000;
    activateTrial("conversion", storage, t0);

    const tExpired = t0 + TRIAL_DURATION_MS;
    const status = getTrialStatus("conversion", storage, tExpired);
    expect(status.expired).toBe(true);
    expect(status.canUse).toBe(false);
    expect(status.isLocked).toBe(true);
    expect(canUseFreeTrial("conversion", storage, tExpired)).toBe(false);
    // Never show "0 hrs remaining" when time is exhausted
    expect(status.statusLabel).not.toContain("0 hrs remaining");
    expect(status.statusLabel).not.toContain("0h Free Trial Remaining");
    expect(status.displayMessage).not.toContain("0 hrs remaining");
  });

  it("locks equation solving permanently after solving 1 equation lifetime", () => {
    const storage = memoryStorage();
    const t0 = 1700000000000;

    // Free user gets 1 equation solve lifetime
    expect(canUseFreeTrial("equation", storage, t0)).toBe(true);
    expect(consumeFreeTrial("equation", storage, t0)).toBe(true);

    // After 1 solve, feature is permanently locked
    expect(canUseFreeTrial("equation", storage, t0)).toBe(false);
    const status = getTrialStatus("equation", storage, t0);
    expect(status.isLocked).toBe(true);
    expect(status.canUse).toBe(false);
    expect(consumeFreeTrial("equation", storage, t0)).toBe(false);
  });
});
