import { useState, useEffect, useCallback } from "react";
import {
  SUBSCRIPTIONS,
  hasActivePlaySubscription,
  buySubscription,
  isPlayBillingAvailable,
} from "@/lib/playBilling";

export function useSubscription() {
  const [isPro, setIsPro] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkStatus = useCallback(async () => {
    try {
      if (isPlayBillingAvailable()) {
        const active = await hasActivePlaySubscription();
        setIsPro(active);
      } else {
        setIsPro(false);
      }
    } catch {
      setIsPro(false);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    void checkStatus();
  }, [checkStatus]);

  const purchase = async (planId: string) => {
    setError(null);
    try {
      const success = await buySubscription(planId);
      if (success) {
        setIsPro(true);
        return true;
      }
      return false;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Subscription failed. Please try again.";
      setError(msg);
      throw err;
    }
  };

  const restore = async () => {
    setError(null);
    try {
      if (!isPlayBillingAvailable()) {
        throw new Error("Google Play billing is available when this app is opened from the Play Store.");
      }
      const active = await hasActivePlaySubscription();
      setIsPro(active);
      return active;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unable to restore purchases.";
      setError(msg);
      throw err;
    }
  };

  return {
    isPro,
    checking,
    error,
    plans: SUBSCRIPTIONS,
    purchase,
    restore,
    checkStatus,
  };
}
