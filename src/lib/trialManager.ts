/**
 * Manages Lifetime Free Trial uses per premium feature.
 * Scientific Calculator is permanently 100% FREE & UNLIMITED for all users.
 * Unit & Currency Converter receives 4 lifetime free trial uses (1 for each of its 4 categories).
 * Other advanced tools (2D Graphing, Step-by-Step Solver, Calculation History) receive 2 lifetime free trial uses.
 */

export function getMaxFeatureTrials(featureKey: string): number {
  if (featureKey === "converter") {
    return 4;
  }
  return 2;
}

export const MAX_FEATURE_FREE_TRIALS = 2; // Default for non-converter features
const FEATURE_TRIAL_PREFIX = "nume.feature_trials.";

export type FeatureKey = "calculator" | "graph" | "equation" | "converter" | "history" | "history_pdf";

export function getFeatureTrialCount(featureKey: string): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = localStorage.getItem(`${FEATURE_TRIAL_PREFIX}${featureKey}`);
    if (!raw) return 0;
    const parsed = parseInt(raw, 10);
    return isNaN(parsed) ? 0 : Math.max(0, parsed);
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
    // Dispatch custom event for real-time UI updates
    window.dispatchEvent(new Event("nume:feature-trial-used"));
    return updated;
  } catch {
    return 0;
  }
}

export function hasFeatureFreeTrials(featureKey: string, isPro: boolean): boolean {
  if (isPro) return true;
  if (featureKey === "calculator") return true;

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

    const isLifetime =
      localStorage.getItem('lifetime_purchased') === 'true' ||
      localStorage.getItem('billing_status') === 'active' ||
      localStorage.getItem('billing_plan_id') === 'lifetime_premium';
    if (isLifetime) return true;

    if (localStorage.getItem('force_trial_lock') === 'true') return false;

    const used = getFeatureTrialCount(featureKey);
    const maxTrials = getMaxFeatureTrials(featureKey);
    return used < maxTrials;
  } catch {
    return true;
  }
}

export function getFeatureRemainingTrials(featureKey: string, isPro: boolean): number {
  if (isPro || featureKey === "calculator") return Infinity;
  if (!hasFeatureFreeTrials(featureKey, isPro)) return 0;
  const used = getFeatureTrialCount(featureKey);
  const maxTrials = getMaxFeatureTrials(featureKey);
  return Math.max(0, maxTrials - used);
}

export function isAppPermanentlyBlocked(isPro: boolean): boolean {
  if (isPro) return false;
  // Blocked if all primary premium tools have used up their free trials
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
  return `${remaining} Free Trial ${remaining === 1 ? "Use" : "Uses"} Left`;
}

export function resetAllFeatureTrials(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem("force_trial_lock");
    ["graph", "equation", "converter", "history", "history_pdf", "equation_camera"].forEach((k) => {
      localStorage.removeItem(`${FEATURE_TRIAL_PREFIX}${k}`);
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
    ["graph", "equation", "converter", "history", "history_pdf", "equation_camera"].forEach((k) => {
      localStorage.setItem(`${FEATURE_TRIAL_PREFIX}${k}`, getMaxFeatureTrials(k).toString());
    });
    window.dispatchEvent(new Event("nume:feature-trial-used"));
  } catch {
    // ignore
  }
}

// Deprecated active day helpers preserved for clean imports
export function recordActiveDay(): void {}
export function saveFirstOpenTimestamp(_ts: number): void {}
export function getFirstOpenTimestamp(): number { return Date.now(); }
