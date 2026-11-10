import { isWithinTrialPeriod } from "./trialManager";

/**
 * Calculator and History are permanently UNLOCKED for all users!
 * 2D Graphing, Equation Solver, and Converter require Lifetime PRO after the 3-day free offer has exhausted.
 */
export const UNLOCKED_FREE_FEATURES = [
  "calculator",
  "history",
  "history_pdf",
] as const;

export const PREMIUM_FEATURES = [
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
  // Scientific Calculator and calculation history are permanently unlocked for everyone!
  if (
    feature === "calculator" ||
    feature === "history" ||
    feature === "history_pdf"
  ) {
    return true;
  }

  if (isPro) return true;
  if (isWithinTrialPeriod()) return true;
  return false;
};

export const canSaveHistory = (_isPro: boolean) => true; // Permanently unlocked for everyone!

