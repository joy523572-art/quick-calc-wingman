/**
 * Manages lifetime Free Trial uses per premium feature with multi-tier persistence.
 * - Scientific Calculator calculations and Offline/Online toggle are permanently FREE & UNLIMITED.
 * - Converter receives 4 free lifetime trial uses.
 * - All other locked features (2D Graphing, Equation Solver, History, PDF Export) receive 3 free lifetime trial uses.
 * - No time-based (24-hour or 3-day) trial gateways exist; trials are purely lifetime count-based per feature.
 */

export function normalizeFeatureKey(featureKey: string): string {
  if (featureKey === "equations") return "equation";
  if (featureKey === "graphs") return "graph";
  if (featureKey === "converters") return "converter";
  return featureKey;
}

export function getMaxFeatureTrials(featureKey: string): number {
  const key = normalizeFeatureKey(featureKey);
  if (key === "converter") {
    return 4;
  }
  return 3;
}

export const MAX_FEATURE_FREE_TRIALS = 3; // Default lifetime trials for non-converter features
const FEATURE_TRIAL_PREFIX = "nume.feature_trials.";
const EQUATION_TEST_PASS_ID = "2026-11-20-eq-1h";
const EQUATION_TEST_PASS_DEADLINE = Date.parse("2026-11-20T18:15:00.000Z");
const EQUATION_TEST_PASS_APPLIED_KEY = "nume.eq_test_pass_applied.v1";
const EQUATION_TEST_PASS_EXPIRES_KEY = "nume.eq_test_pass_expires_at.v1";
const ONE_HOUR_MS = 60 * 60 * 1000;

const ALL_FEATURE_KEYS = [
  "graph",
  "equation",
  "converter",
  "history",
  "history_pdf",
  "equation_camera",
  "equation_pdf",
];

export type FeatureKey =
  | "calculator"
  | "network"
  | "graph"
  | "equation"
  | "converter"
  | "history"
  | "history_pdf"
  | "equation_pdf";

function getCookieTrialCount(featureKey: string): number {
  if (typeof document === "undefined") return 0;
  try {
    const name = `nume_trial_${featureKey}=`;
    const decodedCookie = decodeURIComponent(document.cookie);
    const ca = decodedCookie.split(";");
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i];
      while (c.charAt(0) === " ") {
        c = c.substring(1);
      }
      if (c.indexOf(name) === 0) {
        const val = parseInt(c.substring(name.length, c.length), 10);
        return isNaN(val) ? 0 : Math.max(0, val);
      }
    }
  } catch {
    // ignore cookie read errors
  }
  return 0;
}

function setCookieTrialCount(featureKey: string, count: number): void {
  if (typeof document === "undefined") return;
  try {
    const d = new Date();
    d.setTime(d.getTime() + 10 * 365 * 24 * 60 * 60 * 1000); // 10 years
    const expires = "expires=" + d.toUTCString();
    document.cookie = `nume_trial_${featureKey}=${count};${expires};path=/;SameSite=Lax`;
  } catch {
    // ignore cookie write errors
  }
}

function removeCookieTrialCount(featureKey: string): void {
  if (typeof document === "undefined") return;
  try {
    document.cookie = `nume_trial_${featureKey}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;SameSite=Lax`;
  } catch {
    // ignore cookie clear errors
  }
}

export function getFeatureTrialCount(featureKey: string): number {
  const key = normalizeFeatureKey(featureKey);
  if (typeof window === "undefined") return 0;
  try {
    let localCount = 0;
    const raw = localStorage.getItem(`${FEATURE_TRIAL_PREFIX}${key}`);
    if (raw) {
      const parsed = parseInt(raw, 10);
      if (!isNaN(parsed)) localCount = Math.max(0, parsed);
    }

    const cookieCount = getCookieTrialCount(key);
    const highestCount = Math.max(localCount, cookieCount);

    if (highestCount > localCount) {
      localStorage.setItem(`${FEATURE_TRIAL_PREFIX}${key}`, highestCount.toString());
    }
    if (highestCount > cookieCount) {
      setCookieTrialCount(key, highestCount);
    }

    return highestCount;
  } catch {
    return 0;
  }
}

export function getEquationTestPassRemainingMs(now: number = Date.now()): number {
  if (typeof window === "undefined") return 0;
  try {
    const rawExpires = localStorage.getItem(EQUATION_TEST_PASS_EXPIRES_KEY);
    if (!rawExpires) return 0;
    const expiresAt = Number(rawExpires);
    if (!Number.isFinite(expiresAt) || expiresAt <= now) {
      localStorage.removeItem(EQUATION_TEST_PASS_EXPIRES_KEY);
      return 0;
    }
    return expiresAt - now;
  } catch {
    return 0;
  }
}

export function isEquationTestPassActive(featureKey: string, now: number = Date.now()): boolean {
  if (normalizeFeatureKey(featureKey) !== "equation") return false;
  return getEquationTestPassRemainingMs(now) > 0;
}

/**
 * Grants a one-time 1-hour Equation Solver test permission when the user's lifetime
 * trials were already exhausted, preserving the underlying trial count / lock state
 * so it automatically locks back to its previous state after 1 hour.
 */
export function maybeGrantOneHourEquationTestPass(
  isSubscribed: boolean,
  now: number = Date.now()
): boolean {
  if (typeof window === "undefined" || isSubscribed) return false;
  try {
    if (now >= EQUATION_TEST_PASS_DEADLINE) {
      getEquationTestPassRemainingMs(now);
      return false;
    }

    if (isEquationTestPassActive("equation", now)) {
      return true;
    }

    if (localStorage.getItem(EQUATION_TEST_PASS_APPLIED_KEY) === EQUATION_TEST_PASS_ID) {
      return false;
    }

    const params = new URLSearchParams(window.location.search);
    const urlLocked =
      params.get("trial") === "expired" ||
      params.get("lock") === "true" ||
      params.get("lock") === "1";
    if (urlLocked) return false;

    const prevForceLock = localStorage.getItem("force_trial_lock") === "true";
    const used = getFeatureTrialCount("equation");
    const isLockedByTrials = prevForceLock || used >= getMaxFeatureTrials("equation");
    if (!isLockedByTrials) {
      return false;
    }

    localStorage.setItem(EQUATION_TEST_PASS_APPLIED_KEY, EQUATION_TEST_PASS_ID);
    localStorage.setItem(EQUATION_TEST_PASS_EXPIRES_KEY, String(now + ONE_HOUR_MS));
    window.dispatchEvent(new Event("nume:feature-trial-used"));
    return true;
  } catch {
    return false;
  }
}

export function consumeFeatureTrial(featureKey: string): number {
  const key = normalizeFeatureKey(featureKey);
  if (typeof window === "undefined") return 0;
  if (key === "calculator" || key === "network") return 0;
  if (isEquationTestPassActive(key)) {
    return getFeatureTrialCount(key);
  }

  try {
    const current = getFeatureTrialCount(key);
    const maxTrials = getMaxFeatureTrials(key);
    const updated = Math.min(maxTrials, current + 1);
    localStorage.setItem(`${FEATURE_TRIAL_PREFIX}${key}`, updated.toString());
    setCookieTrialCount(key, updated);

    window.dispatchEvent(new Event("nume:feature-trial-used"));
    return updated;
  } catch {
    return 0;
  }
}

export function hasFeatureFreeTrials(featureKey: string, isSubscribed: boolean): boolean {
  const key = normalizeFeatureKey(featureKey);
  if (isSubscribed) return true;
  if (key === "calculator" || key === "network") return true;

  try {
    if (typeof window === "undefined") return true;

    const params = new URLSearchParams(window.location.search);
    if (
      params.get("trial") === "expired" ||
      params.get("lock") === "true" ||
      params.get("lock") === "1"
    ) {
      return false;
    }

    if (isEquationTestPassActive(key)) {
      return true;
    }

    if (localStorage.getItem("force_trial_lock") === "true") return false;

    const used = getFeatureTrialCount(featureKey);
    const maxTrials = getMaxFeatureTrials(featureKey);
    return used < maxTrials;
  } catch {
    return true;
  }
}

export function getFeatureRemainingTrials(featureKey: string, isSubscribed: boolean): number {
  if (isSubscribed || featureKey === "calculator" || featureKey === "network") return Infinity;
  if (!hasFeatureFreeTrials(featureKey, isSubscribed)) return 0;
  const used = getFeatureTrialCount(featureKey);
  const maxTrials = getMaxFeatureTrials(featureKey);
  return Math.max(0, maxTrials - used);
}

export function isAppPermanentlyBlocked(isSubscribed: boolean): boolean {
  if (isSubscribed) return false;
  const graphExhausted = !hasFeatureFreeTrials("graph", false);
  const eqExhausted = !hasFeatureFreeTrials("equation", false);
  const convExhausted = !hasFeatureFreeTrials("converter", false);
  return graphExhausted && eqExhausted && convExhausted;
}

export function isWithinTrialPeriod(): boolean {
  return !isAppPermanentlyBlocked(false);
}

export function formatTrialTimeRemaining(featureKey: string = "graph"): string {
  if (featureKey === "calculator" || featureKey === "network") {
    return "Unlimited Free";
  }
  if (isEquationTestPassActive(featureKey)) {
    const remainingMs = getEquationTestPassRemainingMs();
    const mins = Math.max(1, Math.ceil(remainingMs / 60000));
    return `Test Access (${mins}m left)`;
  }
  const remaining = getFeatureRemainingTrials(featureKey, false);
  const maxTrials = getMaxFeatureTrials(featureKey);
  if (remaining === 0 || remaining === Infinity) {
    return `Trial Used (${maxTrials}/${maxTrials})`;
  }
  return `${remaining} of ${maxTrials} Free ${remaining === 1 ? "Trial" : "Trials"} Left`;
}

export function resetAllFeatureTrials(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem("force_trial_lock");
    localStorage.removeItem(EQUATION_TEST_PASS_EXPIRES_KEY);
    localStorage.removeItem(EQUATION_TEST_PASS_APPLIED_KEY);
    ALL_FEATURE_KEYS.forEach((k) => {
      localStorage.removeItem(`${FEATURE_TRIAL_PREFIX}${k}`);
      removeCookieTrialCount(k);
    });
    window.dispatchEvent(new Event("nume:feature-trial-used"));
  } catch {
    // ignore
  }
}

export function exhaustAllFeatureTrials(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(EQUATION_TEST_PASS_EXPIRES_KEY);
    localStorage.setItem("force_trial_lock", "true");
    ALL_FEATURE_KEYS.forEach((k) => {
      const max = getMaxFeatureTrials(k);
      localStorage.setItem(`${FEATURE_TRIAL_PREFIX}${k}`, max.toString());
      setCookieTrialCount(k, max);
    });
    window.dispatchEvent(new Event("nume:feature-trial-used"));
  } catch {
    // ignore
  }
}
