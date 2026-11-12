import { isWithinTrialPeriod } from "./trialManager";

/**
 * Calculator calculation engine is permanently UNLOCKED for all users!
 * Calculation History, PDF Export, 2D Graphing, Equation Solver, and Converter require Lifetime PRO after the trial period.
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
  // Scientific Calculator computation is permanently unlocked for everyone!
  if (feature === "calculator") {
    return true;
  }

  if (isPro) return true;
  if (isWithinTrialPeriod()) return true;
  return false;
};

export const canSaveHistory = (isPro: boolean): boolean => canAccessPremiumFeature("history", isPro);
