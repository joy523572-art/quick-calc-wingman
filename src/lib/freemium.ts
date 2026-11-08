import { isWithinTrialPeriod } from "./trialManager";

/**
 * Currency, Weight, Unit, Temperature, and History are permanently UNLOCKED for all users!
 * 2D Graphing and Equation Solver use Lifetime Premium or 1-day free trial.
 */
export const UNLOCKED_FREE_FEATURES = [
  "currency", "weight", "temperature", "length", "history", "history_pdf",
] as const;

export const PREMIUM_FEATURES = [
  "graph", "equation", "equation_camera", "equation_pdf",
] as const;

export type PremiumFeature = typeof PREMIUM_FEATURES[number] | typeof UNLOCKED_FREE_FEATURES[number];

export const canAccessPremiumFeature = (feature: PremiumFeature, isPro: boolean) => {
  // Currency, Weight, Temp, Unit, History are permanently unlocked for everyone!
  if (
    feature === "currency" ||
    feature === "weight" ||
    feature === "temperature" ||
    feature === "length" ||
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
