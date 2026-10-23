import { useState, useEffect, useCallback } from "react";
import {
  SUBSCRIPTIONS,
  hasActivePlaySubscription,
  buySubscription,
  isPlayBillingAvailable,
} from "@/lib/playBilling";

export function usePlayBilling() {
  const [isPro, setIsPro] = useState(false);
  const [loading, setLoading] = useState(true);
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkSubscription = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (!isPlayBillingAvailable()) {
        setIsPro(false);
        return false;
      }
      const active = await hasActivePlaySubscription();
      setIsPro(active);
      return active;
    } catch (err) {
      setIsPro(false);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void checkSubscription();
  }, [checkSubscription]);

  const purchasePlan = useCallback(
    async (planId: string): Promise<boolean> => {
      setPurchaseLoading(true);
      setError(null);
      try {
        await buySubscription(planId);
        const active = await hasActivePlaySubscription();
        setIsPro(active);
        return active;
      } catch (err: unknown) {
        const msg = (err as Error)?.message || "Google Play billing is available when installed from Google Play Store.";
        setError(msg);
        return false;
      } finally {
        setPurchaseLoading(false);
      }
    },
    []
  );

  return {
    isPro,
    loading,
    purchaseLoading,
    error,
    plans: SUBSCRIPTIONS,
    checkSubscription,
    purchasePlan,
    isAvailable: isPlayBillingAvailable(),
  };
}
