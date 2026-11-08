import { useState, useEffect, useCallback } from "react";
import {
  SUBSCRIPTIONS,
  hasActivePlaySubscription,
  buySubscription,
  isPlayBillingAvailable,
  getWebSubscriptionRecord,
  cancelWebSubscription,
  WebSubscriptionRecord,
} from "@/lib/playBilling";

export function usePlayBilling() {
  const [isPro, setIsPro] = useState(false);
  const [loading, setLoading] = useState(true);
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subscriptionRecord, setSubscriptionRecord] = useState<WebSubscriptionRecord | null>(null);

  const checkSubscription = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const active = await hasActivePlaySubscription();
      setIsPro(active);
      setSubscriptionRecord(getWebSubscriptionRecord());
      return active;
    } catch {
      setIsPro(false);
      setSubscriptionRecord(null);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void checkSubscription();
  }, [checkSubscription]);

  const purchasePlan = useCallback(
    async (productId: string, basePlanId?: string, email?: string): Promise<boolean> => {
      setPurchaseLoading(true);
      setError(null);
      try {
        await buySubscription(productId, basePlanId, email);
        const active = await hasActivePlaySubscription();
        setIsPro(active);
        setSubscriptionRecord(getWebSubscriptionRecord());
        return active;
      } catch (err: unknown) {
        const msg = (err as Error)?.message || "Subscription could not be completed.";
        setError(msg);
        try {
          localStorage.setItem("billing_status", "failed");
        } catch {
          // ignore
        }
        return false;
      } finally {
        setPurchaseLoading(false);
      }
    },
    []
  );

  const cancelSub = useCallback(() => {
    cancelWebSubscription();
    setIsPro(false);
    setSubscriptionRecord(null);
  }, []);

  return {
    isPro,
    loading,
    purchaseLoading,
    error,
    subscriptionRecord,
    plans: SUBSCRIPTIONS,
    checkSubscription,
    purchasePlan,
    cancelSubscription: cancelSub,
    isAvailable: isPlayBillingAvailable(),
  };
}
