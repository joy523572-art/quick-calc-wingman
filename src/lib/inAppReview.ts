// Google Play In-App Review API helper
export const requestInAppReview = async (): Promise<void> => {
  if (typeof window === "undefined") return;
  // If running inside Android TWA or Play Store wrapper, triggers review flow
  // Fallback to opening store listing or toast/alert if simulated
  const playStoreUrl = "https://play.google.com/store/apps/details?id=scientific.calculator.cm";
  try {
    if ((window as any).Android && typeof (window as any).Android.launchReview === "function") {
      (window as any).Android.launchReview();
    } else {
      window.open(playStoreUrl, "_blank");
    }
  } catch {
    window.open(playStoreUrl, "_blank");
  }
};
