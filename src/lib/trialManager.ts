/**
 * Manages Free Trial uses per premium feature with 24-hour expiry & multi-tier permanent persistence.
 * Calculator calculation engine and Offline/Online toggle are permanently 100% FREE & UNLIMITED.
 * Unit & Currency Converter receives 4 free lifetime trial uses.
 * Other advanced tools (2D Graphing, Step-by-Step Solver, Calculation History) receive 3 free lifetime trial uses.
 * Activated free trials automatically expire after 24 hours.
 */

export function getMaxFeatureTrials(featureKey: string): number {
  if (featureKey === "converter") {
    return 4;
  }
  return 3;
}

export const MAX_FEATURE_FREE_TRIALS = 3; // Default for non-converter features
const FEATURE_TRIAL_PREFIX = "nume.feature_trials.";
const TRIAL_TIMESTAMP_PREFIX = "nume.trial_timestamp.";
const TRIAL_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const ALL_FEATURE_KEYS = ["graph", "equation", "converter", "history", "history_pdf", "equation_camera"];

export type FeatureKey = "calculator" | "graph" | "equation" | "converter" | "history" | "history_pdf";

// Helper: Read Cookie
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
    // ignore
  }
  return 0;
}

// Helper: Write Cookie with 10-year expiration
function setCookieTrialCount(featureKey: string, count: number): void {
  if (typeof document === "undefined") return;
  try {
    const d = new Date();
    d.setTime(d.getTime() + 10 * 365 * 24 * 60 * 60 * 1000); // 10 years
    const expires = "expires=" + d.toUTCString();
    document.cookie = `nume_trial_${featureKey}=${count};${expires};path=/;SameSite=Lax`;
  } catch {
    // ignore
  }
}

// Helper: Clear Cookie
function removeCookieTrialCount(featureKey: string): void {
  if (typeof document === "undefined") return;
  try {
    document.cookie = `nume_trial_${featureKey}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;SameSite=Lax`;
  } catch {
    // ignore
  }
}

/**
 * Checks if the 24-hour trial window for a feature has expired.
 * If expired, trial count resets to allow fresh trials.
 */
function checkAndResetExpiredTrial(featureKey: string): void {
  if (typeof window === "undefined") return;
  try {
    const rawTimestamp = localStorage.getItem(`${TRIAL_TIMESTAMP_PREFIX}${featureKey}`);
    if (rawTimestamp) {
      const startTime = parseInt(rawTimestamp, 10);
      if (!isNaN(startTime) && Date.now() - startTime > TRIAL_EXPIRY_MS) {
        // 24 hours elapsed — reset trial count for this feature
        localStorage.removeItem(`${FEATURE_TRIAL_PREFIX}${featureKey}`);
        localStorage.removeItem(`${TRIAL_TIMESTAMP_PREFIX}${featureKey}`);
        removeCookieTrialCount(featureKey);
      }
    }
  } catch {
    // ignore
  }
}

export function getFeatureTrialCount(featureKey: string): number {
  if (typeof window === "undefined") return 0;
  try {
    checkAndResetExpiredTrial(featureKey);

    let localCount = 0;
    const raw = localStorage.getItem(`${FEATURE_TRIAL_PREFIX}${featureKey}`);
    if (raw) {
      const parsed = parseInt(raw, 10);
      if (!isNaN(parsed)) localCount = Math.max(0, parsed);
    }

    const cookieCount = getCookieTrialCount(featureKey);

    // Take highest value across local storage & cookies
    const highestCount = Math.max(localCount, cookieCount);

    if (highestCount > localCount) {
      localStorage.setItem(`${FEATURE_TRIAL_PREFIX}${featureKey}`, highestCount.toString());
    }
    if (highestCount > cookieCount) {
      setCookieTrialCount(featureKey, highestCount);
    }

    return highestCount;
  } catch {
    return 0;
  }
}

export function consumeFeatureTrial(featureKey: string): number {
  if (typeof window === "undefined") return 0;
  try {
    const current = getFeatureTrialCount(featureKey);
    const updated = current + 1;
    localStorage.setItem(`${FEATURE_TRIAL_PREFIX}${featureKey}`, updated.toString());
    setCookieTrialCount(featureKey, updated);

    // Set 24-hour start timestamp if not already set
    if (!localStorage.getItem(`${TRIAL_TIMESTAMP_PREFIX}${featureKey}`)) {
      localStorage.setItem(`${TRIAL_TIMESTAMP_PREFIX}${featureKey}`, Date.now().toString());
    }

    // Dispatch custom event for real-time UI updates
    window.dispatchEvent(new Event("nume:feature-trial-used"));
    return updated;
  } catch {
    return 0;
  }
}

export function hasFeatureFreeTrials(featureKey: string, isPro: boolean): boolean {
  if (isPro) return true;
  if (featureKey === "calculator" || featureKey === "network") return true;

  try {
    if (typeof window === "undefined") return true;

    // Check URL override for instant testing (?lock=1 or ?trial=expired)
    const params = new URLSearchParams(window.location.search);
    if (
      params.get("trial") === "expired" ||
      params.get("lock") === "true" ||
      params.get("lock") === "1"
    ) {
      return false;
    }

    const isSubscribed =
      localStorage.getItem('subscription_active') === 'true' ||
      localStorage.getItem('billing_status') === 'active' ||
      localStorage.getItem('billing_plan_id') === 'premium_monthly' ||
      localStorage.getItem('billing_plan_id') === 'premium_weekly';
    if (isSubscribed) return true;

    if (localStorage.getItem('force_trial_lock') === 'true') return false;

    checkAndResetExpiredTrial(featureKey);

    const used = getFeatureTrialCount(featureKey);
    const maxTrials = getMaxFeatureTrials(featureKey);
    return used < maxTrials;
  } catch {
    return true;
  }
}

export function getFeatureRemainingTrials(featureKey: string, isPro: boolean): number {
  if (isPro || featureKey === "calculator" || featureKey === "network") return Infinity;
  if (!hasFeatureFreeTrials(featureKey, isPro)) return 0;
  const used = getFeatureTrialCount(featureKey);
  const maxTrials = getMaxFeatureTrials(featureKey);
  return Math.max(0, maxTrials - used);
}

export function isAppPermanentlyBlocked(isPro: boolean): boolean {
  if (isPro) return false;
  const graphExhausted = !hasFeatureFreeTrials("graph", false);
  const eqExhausted = !hasFeatureFreeTrials("equation", false);
  const convExhausted = !hasFeatureFreeTrials("converter", false);
  return graphExhausted && eqExhausted && convExhausted;
}

export function isWithinTrialPeriod(): boolean {
  return !isAppPermanentlyBlocked(false);
}

export function formatTrialTimeRemaining(featureKey: string = "graph"): string {
  const remaining = getFeatureRemainingTrials(featureKey, false);
  const maxTrials = getMaxFeatureTrials(featureKey);
  if (remaining === 0 || remaining === Infinity) return `Trial Used (${maxTrials}/${maxTrials})`;
  return `${remaining} Free Trial ${remaining === 1 ? "Use" : "Uses"} Left (24h Window)`;
}

export function resetAllFeatureTrials(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem("force_trial_lock");
    ALL_FEATURE_KEYS.forEach((k) => {
      localStorage.removeItem(`${FEATURE_TRIAL_PREFIX}${k}`);
      localStorage.removeItem(`${TRIAL_TIMESTAMP_PREFIX}${k}`);
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

export function recordActiveDay(): void {}
export function saveFirstOpenTimestamp(_ts: number): void {}
export function getFirstOpenTimestamp(): number { return Date.now(); }
