import { hasFeatureFreeTrials } from "./trialManager";

/**
 * Scientific Calculator calculation engine is permanently 100% FREE & UNLIMITED for all users!
 * Calculation History, PDF Export, 2D Graphing, Equation Solver, and Converter each grant
 * 2 Lifetime Free Trials before requiring Lifetime PRO ($19.99).
 */
export const UNLOCKED_FREE_FEATURES = [
  "calculator",
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

export type PremiumFeature = typeof PREMIUM_FEATURES[number] | typeof UNLOCKED_FREE_FEATURES[number];

export const canAccessPremiumFeature = (feature: PremiumFeature, isPro: boolean): boolean => {
  // Scientific Calculator computation is permanently unlocked and unlimited for everyone!
  if (feature === "calculator") {
    return true;
  }

  return hasFeatureFreeTrials(feature, isPro);
};

export const canSaveHistory = (isPro: boolean): boolean => canAccessPremiumFeature("history", isPro);
