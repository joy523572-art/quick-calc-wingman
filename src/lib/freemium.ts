/** Advanced tools require PRO; the scientific calculator is always unlimited. */
export const PREMIUM_FEATURES = [
  "graph", "equation", "equation_camera", "equation_pdf",
  "currency", "weight", "temperature", "length", "history", "history_pdf",
] as const;
export type PremiumFeature = typeof PREMIUM_FEATURES[number];

export const canAccessPremiumFeature = (_feature: PremiumFeature, isPro: boolean) => isPro;
export const canSaveHistory = (isPro: boolean) => canAccessPremiumFeature("history", isPro);
