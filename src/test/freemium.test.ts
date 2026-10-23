import { describe, expect, it } from "vitest";
import { canSaveHistory, canUseFreeTrial, consumeFreeTrial, TRIAL_FEATURES } from "@/lib/freemium";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    values,
  };
}

describe("free-plan limits", () => {
  it.each(TRIAL_FEATURES)("allows exactly one lifetime free use of %s", (feature) => {
    const storage = memoryStorage();
    expect(canUseFreeTrial(feature, storage)).toBe(true);
    expect(consumeFreeTrial(feature, storage)).toBe(true);
    expect(canUseFreeTrial(feature, storage)).toBe(false);
    expect(consumeFreeTrial(feature, storage)).toBe(false);
  });

  it("keeps a used trial locked when one storage copy is wiped", () => {
    const storage = memoryStorage();
    consumeFreeTrial("graph", storage);
    storage.values.delete("nume.lifetime-trials.v2");
    expect(canUseFreeTrial("graph", storage)).toBe(false);
  });

  it("history saving is premium only", () => {
    expect(canSaveHistory(false)).toBe(false);
    expect(canSaveHistory(true)).toBe(true);
  });
});
