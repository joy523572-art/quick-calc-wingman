export const TRIAL_DURATION_HOURS = 24;
export const TRIAL_DURATION_MS = TRIAL_DURATION_HOURS * 60 * 60 * 1000;
export const TRIAL_STEP_HOURS = 5;

export const FREE_LIMITS = {
  maxTrialsPerFeature: 1,
  dailyHistorySaves: 1,
  trialDurationHours: 24,
  trialDurationMs: TRIAL_DURATION_MS,
  graph: 1,
  graphs: 1,
  equation: 1,
  equations: 1,
  conversion: 1,
  conversions: 1,
  camera: 1,
  voice: 1,
  pdf: 1,
  copy: 1,
  history: 1,
} as const;

export type TrialFeature =
  | "graph"
  | "equation"
  | "conversion"
  | "camera"
  | "voice"
  | "pdf"
  | "copy"
  | "history";

export type TrialStatus = {
  feature: TrialFeature;
  activated: boolean;
  activatedAt: number | null;
  expired: boolean;
  trialCount: number;
  trialLimit: number;
  isLocked: boolean;
  canUse: boolean;
  elapsedMs: number;
  elapsedHours: number;
  hoursRemaining: number;
  intervalRemainingHours: number;
  usedFiveHourBlock: number;
  progressPercent: number;
  statusLabel: string;
  displayMessage: string;
};

type UsageState = {
  day: string;
  historySaves: number;
  trials: Record<TrialFeature, number>;
  trialStartedAt: Partial<Record<TrialFeature, number>>;
};

export type StorageLike = Pick<Storage, "getItem" | "setItem">;

const STORAGE_KEY = "nume.free-usage.v1";
const PERMANENT_STARTS_KEY = "nume.trial-starts.permanent.v1";
const PERMANENT_COUNTS_KEY = "nume.trial-counts.permanent.v1";

const defaultTrials = (): Record<TrialFeature, number> => ({
  graph: 0,
  equation: 0,
  conversion: 0,
  camera: 0,
  voice: 0,
  pdf: 0,
  copy: 0,
  history: 0,
});

const emptyUsage = (day = new Date().toISOString().slice(0, 10)): UsageState => ({
  day,
  historySaves: 0,
  trials: defaultTrials(),
  trialStartedAt: {},
});

const getStorage = (): StorageLike | undefined => {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
};

// Permanent start times that never reset on day change, logout, or session reload
export const readPermanentStartTimes = (storage = getStorage()): Partial<Record<TrialFeature, number>> => {
  if (!storage) return {};
  try {
    const raw = storage.getItem(PERMANENT_STARTS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

export const writePermanentStartTimes = (starts: Partial<Record<TrialFeature, number>>, storage = getStorage()) => {
  try {
    storage?.setItem(PERMANENT_STARTS_KEY, JSON.stringify(starts));
  } catch {
    // ignore
  }
};

// Permanent trial counts (1 trial only -> then locked forever)
export const readPermanentTrialCounts = (storage = getStorage()): Partial<Record<TrialFeature, number>> => {
  if (!storage) return {};
  try {
    const raw = storage.getItem(PERMANENT_COUNTS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

export const writePermanentTrialCounts = (counts: Partial<Record<TrialFeature, number>>, storage = getStorage()) => {
  try {
    storage?.setItem(PERMANENT_COUNTS_KEY, JSON.stringify(counts));
  } catch {
    // ignore
  }
};

export const readUsage = (storage = getStorage()): UsageState => {
  if (!storage) return emptyUsage();
  try {
    const permStarts = readPermanentStartTimes(storage);
    const permCounts = readPermanentTrialCounts(storage);

    const stored = storage.getItem(STORAGE_KEY);
    const parsed = stored ? (JSON.parse(stored) as Partial<UsageState>) : {};
    const today = new Date().toISOString().slice(0, 10);

    const mergedStarts: Partial<Record<TrialFeature, number>> = {
      ...parsed.trialStartedAt,
      ...permStarts,
    };

    const mergedTrials: Record<TrialFeature, number> = {
      ...defaultTrials(),
      ...(parsed.trials || {}),
      ...(permCounts || {}),
    };

    // Ensure historySaves matches history trials
    const historySaves = Math.max(mergedTrials.history, Number(parsed.historySaves) || 0);
    mergedTrials.history = historySaves;

    return {
      day: today,
      historySaves,
      trials: mergedTrials,
      trialStartedAt: mergedStarts,
    };
  } catch {
    return emptyUsage();
  }
};

const writeUsage = (usage: UsageState, storage = getStorage()) => {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(usage));
    writePermanentStartTimes(usage.trialStartedAt, storage);
    writePermanentTrialCounts(usage.trials, storage);
  } catch {
    // ignore
  }
};

export const getDailyHistorySaveCount = (storage?: StorageLike) => {
  const usage = readUsage(storage);
  return Math.max(usage.historySaves, usage.trials.history ?? 0);
};

export const canSaveFreeHistory = (storage?: StorageLike, now = Date.now()) => {
  return canUseFreeTrial("history", storage, now);
};

export const consumeDailyHistorySave = (storage?: StorageLike, now = Date.now()) => {
  return consumeFreeTrial("history", storage, now);
};

export const getTrialStartTime = (
  feature: TrialFeature,
  storage?: StorageLike
): number | null => {
  const permStarts = readPermanentStartTimes(storage);
  if (typeof permStarts[feature] === "number") {
    return permStarts[feature]!;
  }
  return readUsage(storage).trialStartedAt[feature] ?? null;
};

export const isTrialActivated = (
  feature: TrialFeature,
  storage?: StorageLike
): boolean => {
  return getTrialStartTime(feature, storage) !== null;
};

export const activateTrial = (
  feature: TrialFeature,
  storage?: StorageLike,
  now = Date.now()
): number => {
  const existing = getTrialStartTime(feature, storage);
  if (existing !== null) {
    // NEVER restart fresh on any re-activation, login, or session
    return existing;
  }

  const usage = readUsage(storage);
  usage.trialStartedAt[feature] = now;
  writeUsage(usage, storage);

  const permStarts = readPermanentStartTimes(storage);
  permStarts[feature] = now;
  writePermanentStartTimes(permStarts, storage);

  return now;
};

export const getTrialUseCount = (feature: TrialFeature, storage?: StorageLike): number => {
  const permCounts = readPermanentTrialCounts(storage);
  const countFromPerm = permCounts[feature];
  if (typeof countFromPerm === "number") {
    return countFromPerm;
  }
  return readUsage(storage).trials[feature] ?? 0;
};

export const getTrialStatus = (
  feature: TrialFeature,
  storage?: StorageLike,
  now = Date.now()
): TrialStatus => {
  const startTime = getTrialStartTime(feature, storage);
  const trialCount = getTrialUseCount(feature, storage);
  const trialLimit = FREE_LIMITS.maxTrialsPerFeature; // Exactly 1 trial

  if (!startTime) {
    const isLocked = trialCount >= trialLimit;
    return {
      feature,
      activated: false,
      activatedAt: null,
      expired: false,
      trialCount,
      trialLimit,
      isLocked,
      canUse: !isLocked,
      elapsedMs: 0,
      elapsedHours: 0,
      hoursRemaining: TRIAL_DURATION_HOURS,
      intervalRemainingHours: TRIAL_DURATION_HOURS,
      usedFiveHourBlock: 0,
      progressPercent: 0,
      statusLabel: isLocked ? "Locked to Premium" : "1 Free Trial Available",
      displayMessage: isLocked
        ? "This feature has used its 1 free trial and is locked to Premium forever. Upgrade to Nume Pro to unlock."
        : "1 free trial available. Upgrade to PRO to unlock all features permanently.",
    };
  }

  const elapsedMs = Math.max(0, now - startTime);
  const elapsedHours = Math.floor(elapsedMs / (60 * 60 * 1000));
  const expired = elapsedMs >= TRIAL_DURATION_MS;
  const hoursRemaining = Math.max(0, TRIAL_DURATION_HOURS - elapsedHours);
  const usedFiveHourBlock = Math.min(20, Math.floor(elapsedHours / 5) * 5);
  const intervalRemainingHours = Math.max(0, TRIAL_DURATION_HOURS - usedFiveHourBlock);
  const progressPercent = Math.min(100, Math.round((elapsedMs / TRIAL_DURATION_MS) * 100));

  // Lock to Premium forever if either 1 trial has been consumed OR the 24h countdown window expired
  const isLocked = expired || trialCount >= trialLimit;
  const canUse = !isLocked;

  if (expired) {
    return {
      feature,
      activated: true,
      activatedAt: startTime,
      expired: true,
      trialCount,
      trialLimit,
      isLocked: true,
      canUse: false,
      elapsedMs,
      elapsedHours,
      hoursRemaining: 0,
      intervalRemainingHours: 0,
      usedFiveHourBlock: 24,
      progressPercent: 100,
      statusLabel: "Trial used",
      displayMessage: "Your free trial has ended. Upgrade to PRO to unlock.",
    };
  }

  if (trialCount >= trialLimit) {
    return {
      feature,
      activated: true,
      activatedAt: startTime,
      expired: false,
      trialCount,
      trialLimit,
      isLocked: true,
      canUse: false,
      elapsedMs,
      elapsedHours,
      hoursRemaining,
      intervalRemainingHours,
      usedFiveHourBlock,
      progressPercent,
      statusLabel: "Premium",
      displayMessage: "You have used your 1 free trial for this feature. Upgrade to PRO to unlock.",
    };
  }

  return {
    feature,
    activated: true,
    activatedAt: startTime,
    expired: false,
    trialCount,
    trialLimit,
    isLocked: false,
    canUse: true,
    elapsedMs,
    elapsedHours,
    hoursRemaining,
    intervalRemainingHours,
    usedFiveHourBlock,
    progressPercent,
    statusLabel: hoursRemaining > 0 ? `${hoursRemaining}h Free Trial Remaining` : "Trial used",
    displayMessage:
      hoursRemaining > 0
        ? `${hoursRemaining} hrs remaining. Upgrade to PRO to unlock all features.`
        : "Free trial time exhausted. Upgrade to PRO to unlock all features.",
  };
};

export const canUseFreeTrial = (
  feature: TrialFeature,
  storage?: StorageLike,
  now = Date.now()
): boolean => {
  return getTrialStatus(feature, storage, now).canUse;
};

export const consumeFreeTrial = (
  feature: TrialFeature,
  storage?: StorageLike,
  now = Date.now()
): boolean => {
  const usage = readUsage(storage);
  if (!usage.trialStartedAt[feature]) {
    usage.trialStartedAt[feature] = now;
  }
  const elapsedMs = now - usage.trialStartedAt[feature]!;
  if (elapsedMs >= TRIAL_DURATION_MS) {
    return false;
  }
  const currentCount = usage.trials[feature] ?? 0;
  if (currentCount >= FREE_LIMITS.maxTrialsPerFeature) {
    return false;
  }

  usage.trials[feature] = currentCount + 1;
  writeUsage(usage, storage);
  return true;
};
