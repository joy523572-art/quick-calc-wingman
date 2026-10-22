import { describe, expect, it } from "vitest";
import {
  canSaveFreeHistory,
  canUseFreeTrial,
  consumeDailyHistorySave,
  consumeFreeTrial,
  FREE_LIMITS,
} from "@/lib/freemium";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
}

describe("free-plan limits", () => {
  it("allows exactly three history saves per day", () => {
    const storage = memoryStorage();
    expect(FREE_LIMITS.dailyHistorySaves).toBe(3);
    expect(consumeDailyHistorySave(storage)).toBe(true);
    expect(consumeDailyHistorySave(storage)).toBe(true);
    expect(consumeDailyHistorySave(storage)).toBe(true);
    expect(canSaveFreeHistory(storage)).toBe(false);
    expect(consumeDailyHistorySave(storage)).toBe(false);
  });

  it.each([
    ["graph", 1],
    ["equation", 1],
    ["conversion", 1],
  ] as const)("allows exactly %s free trial use(s): %i", (feature, limit) => {
    const storage = memoryStorage();
    const declaredLimit = feature === "graph" ? FREE_LIMITS.graph : feature === "equation" ? FREE_LIMITS.equations : FREE_LIMITS.conversions;
    expect(declaredLimit).toBe(limit);
    expect(canUseFreeTrial(feature, storage)).toBe(true);
    expect(consumeFreeTrial(feature, storage)).toBe(true);
    expect(canUseFreeTrial(feature, storage)).toBe(false);
    expect(consumeFreeTrial(feature, storage)).toBe(false);
  });

  it("keeps all scientific calculator calculations unlimited", () => {
    expect(FREE_LIMITS).not.toHaveProperty("calculations");
  });
});