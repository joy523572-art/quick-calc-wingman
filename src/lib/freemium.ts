export const FREE_LIMITS = {
  dailyHistorySaves: 3,
  graphs: 1,
  equations: 1,
  conversions: 1,
} as const;

export type TrialFeature = "graph" | "equation" | "conversion";

type UsageState = {
  day: string;
  historySaves: number;
  trials: Record<TrialFeature, number>;
};

type StorageLike = Pick<Storage, "getItem" | "setItem">;

const STORAGE_KEY = "nume.free-usage.v1";
const emptyUsage = (day = new Date().toISOString().slice(0, 10)): UsageState => ({
  day,
  historySaves: 0,
  trials: { graph: 0, equation: 0, conversion: 0 },
});

const getStorage = (): StorageLike | undefined => {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
};

const readUsage = (storage = getStorage()): UsageState => {
  if (!storage) return emptyUsage();
  try {
    const stored = storage.getItem(STORAGE_KEY);
    if (!stored) return emptyUsage();
    const parsed = JSON.parse(stored) as Partial<UsageState>;
    const today = new Date().toISOString().slice(0, 10);
    if (parsed.day !== today) return emptyUsage(today);
    return {
      day: today,
      historySaves: Math.max(0, Number(parsed.historySaves) || 0),
      trials: {
        graph: Math.max(0, Number(parsed.trials?.graph) || 0),
        equation: Math.max(0, Number(parsed.trials?.equation) || 0),
        conversion: Math.max(0, Number(parsed.trials?.conversion) || 0),
      },
    };
  } catch {
    return emptyUsage();
  }
};

const writeUsage = (usage: UsageState, storage = getStorage()) => {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(usage));
  } catch {
    // Keep the calculator usable when browser storage is unavailable.
  }
};

export const getDailyHistorySaveCount = (storage?: StorageLike) => readUsage(storage).historySaves;

export const canSaveFreeHistory = (storage?: StorageLike) =>
  getDailyHistorySaveCount(storage) < FREE_LIMITS.dailyHistorySaves;

export const consumeDailyHistorySave = (storage?: StorageLike) => {
  const usage = readUsage(storage);
  if (usage.historySaves >= FREE_LIMITS.dailyHistorySaves) return false;
  usage.historySaves += 1;
  writeUsage(usage, storage);
  return true;
};

export const getTrialUseCount = (feature: TrialFeature, storage?: StorageLike) =>
  readUsage(storage).trials[feature];

export const canUseFreeTrial = (feature: TrialFeature, storage?: StorageLike) =>
  getTrialUseCount(feature, storage) < 1;

export const consumeFreeTrial = (feature: TrialFeature, storage?: StorageLike) => {
  const usage = readUsage(storage);
  if (usage.trials[feature] >= 1) return false;
  usage.trials[feature] += 1;
  writeUsage(usage, storage);
  return true;
};