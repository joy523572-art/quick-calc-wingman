import { useCallback, useEffect, useState } from "react";

/**
 * Lifetime free trials. Each premium feature allows exactly ONE free use, ever.
 * Trials never reset by date, reload, sign-out or "Delete All Local Data".
 * The scientific calculator is NOT listed here — it stays free and unlimited.
 */
export type TrialFeature =
  | "graph"
  | "equation"
  | "equation_camera"
  | "equation_pdf"
  | "currency"
  | "weight"
  | "temperature"
  | "length";

export const TRIAL_FEATURES: TrialFeature[] = [
  "graph", "equation", "equation_camera", "equation_pdf", "currency", "weight", "temperature", "length",
];

export const FREE_TRIAL_LIMIT = 1;

/** History saving is a premium-only feature (no free saves). */
export const canSaveHistory = (isPro: boolean) => isPro;

type StorageLike = Pick<Storage, "getItem" | "setItem">;
type TrialState = Partial<Record<TrialFeature, number>>;

export const TRIAL_STORAGE_KEYS = ["nume.lifetime-trials.v2", "nume.lt.backup"] as const;
const LEGACY_KEY = "nume.free-usage.v1";
export const TRIALS_UPDATED_EVENT = "nume:trials-updated";

const getStorage = (): StorageLike | undefined => {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
};

const parse = (raw: string | null): TrialState => {
  if (!raw) return {};
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    const src = (obj.trials as Record<string, unknown>) ?? obj;
    const out: TrialState = {};
    for (const f of TRIAL_FEATURES) out[f] = Math.max(0, Number(src[f]) || 0);
    // Legacy combined "conversion" trial counts against every converter category.
    const legacyConv = Math.max(0, Number(src.conversion) || 0);
    if (legacyConv) for (const f of ["currency", "weight", "temperature", "length"] as const) out[f] = Math.max(out[f] ?? 0, legacyConv);
    return out;
  } catch {
    return {};
  }
};

const readTrials = (storage = getStorage()): TrialState => {
  if (!storage) return {};
  const sources = [...TRIAL_STORAGE_KEYS, LEGACY_KEY].map((k) => parse(storage.getItem(k)));
  const merged: TrialState = {};
  // Take the highest count from every copy so a used trial can never be "un-used".
  for (const f of TRIAL_FEATURES) merged[f] = Math.max(0, ...sources.map((s) => s[f] ?? 0));
  return merged;
};

const writeTrials = (state: TrialState, storage = getStorage()) => {
  try {
    const raw = JSON.stringify(state);
    for (const k of TRIAL_STORAGE_KEYS) storage?.setItem(k, raw);
  } catch {
    // Storage unavailable — calculator keeps working.
  }
  if (typeof window !== "undefined") window.dispatchEvent(new Event(TRIALS_UPDATED_EVENT));
};

export const getTrialUseCount = (feature: TrialFeature, storage?: StorageLike) =>
  readTrials(storage)[feature] ?? 0;

export const canUseFreeTrial = (feature: TrialFeature, storage?: StorageLike) =>
  getTrialUseCount(feature, storage) < FREE_TRIAL_LIMIT;

export const consumeFreeTrial = (feature: TrialFeature, storage?: StorageLike) => {
  const state = readTrials(storage);
  if ((state[feature] ?? 0) >= FREE_TRIAL_LIMIT) return false;
  state[feature] = (state[feature] ?? 0) + 1;
  writeTrials(state, storage);
  return true;
};

/** Snapshot of trial data, used to survive "Delete All Local Data". */
export const snapshotTrials = () => JSON.stringify(readTrials());
export const restoreTrials = (snapshot: string) => writeTrials(parse(snapshot));

/** React hook: is this feature locked for the user, and a function to use the trial. */
export function useTrial(feature: TrialFeature, isPro: boolean) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const on = () => setTick((t) => t + 1);
    window.addEventListener(TRIALS_UPDATED_EVENT, on);
    window.addEventListener("storage", on);
    return () => {
      window.removeEventListener(TRIALS_UPDATED_EVENT, on);
      window.removeEventListener("storage", on);
    };
  }, []);
  const locked = !isPro && !canUseFreeTrial(feature);
  /** Returns true when the action may run (PRO, or the free trial was just used). */
  const use = useCallback(() => (isPro ? true : consumeFreeTrial(feature)), [feature, isPro]);
  return { locked, use };
}
