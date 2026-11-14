import { hasFeatureFreeTrials } from "./trialManager";

/**
 * Scientific Calculator calculation engine and Online/Offline toggle are permanently 100% FREE & UNLIMITED.
 * Converter grants 4 free lifetime trials.
 * All other locked features (2D Graphing, Equation Solver, History, PDF Exports) grant 3 free lifetime trials
 * before requiring an active Monthly or Weekly subscription.
 */
export const UNLOCKED_FREE_FEATURES = [
  "calculator",
  "network",
] as const;

export const PREMIUM_FEATURES = [
  "history",
  "history_pdf",
  "graph",
  "equation",
  "equation_camera",
  "equation_pdf",
  "converter",
  "currency",
  "weight",
  "temperature",
  "length",
] as const;

export type PremiumFeature =
  | (typeof PREMIUM_FEATURES)[number]
  | (typeof UNLOCKED_FREE_FEATURES)[number];

export const canAccessPremiumFeature = (
  feature: PremiumFeature,
  isSubscribed: boolean
): boolean => {
  if (feature === "calculator" || feature === "network") {
    return true;
  }
  return hasFeatureFreeTrials(feature, isSubscribed);
};

export const canSaveHistory = (isSubscribed: boolean): boolean =>
  canAccessPremiumFeature("history", isSubscribed);

export const canToggleNetwork = (): boolean => true;
