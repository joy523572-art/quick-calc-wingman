import { useState, useEffect, useCallback } from "react";
import {
  SUBSCRIPTIONS,
  hasActivePlaySubscription,
  buySubscription,
  isPlayBillingAvailable,
  resetPlaySubscription,
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
      const active = await hasActivePlaySubscription();
      setIsPro(active);
      return active;
    } catch {
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
    async (productId: string, basePlanId?: string): Promise<boolean> => {
      setPurchaseLoading(true);
      setError(null);
      try {
        const result = await buySubscription(productId, basePlanId);
        if (result && result.success) {
          setIsPro(true);
          return true;
        }
        return false;
      } catch (err: unknown) {
        const msg = (err as Error)?.message || "Subscription could not be completed.";
        setError(msg);
        try {
          localStorage.setItem("billing_status", "failed");
        } catch {
          // ignore
        }
        throw err;
      } finally {
        setPurchaseLoading(false);
      }
    },
    []
  );

  const cancelSub = useCallback(() => {
    resetPlaySubscription();
    setIsPro(false);
  }, []);

  return {
    isPro,
    loading,
    purchaseLoading,
    error,
    plans: SUBSCRIPTIONS,
    checkSubscription,
    purchasePlan,
    cancelSubscription: cancelSub,
    isAvailable: isPlayBillingAvailable(),
  };
}

