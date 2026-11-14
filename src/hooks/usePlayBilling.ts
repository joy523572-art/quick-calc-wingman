import { useState, useEffect, useCallback } from "react";
import {
  SubscriptionPlan,
  getCachedProductPlans,
  queryProductDetailsAsync,
  hasActivePlaySubscription,
  buySubscription,
  isPlayBillingAvailable,
  resetPlaySubscription,
  registerWindowBillingBridge,
  SUBSCRIPTION_UPDATED_EVENT,
  PRODUCT_DETAILS_UPDATED_EVENT,
} from "@/lib/playBilling";
import {
  fetchProfileSubscription,
  ProfileSubscriptionRecord,
  readLocalSubscriptionMetadata,
  SubscriptionStatus,
} from "@/lib/subscriptionSync";

function getInitialActiveState(): boolean {
  if (typeof window === "undefined") return false;
  const meta = readLocalSubscriptionMetadata();
  return (
    localStorage.getItem("isPremium") === "true" ||
    localStorage.getItem("subscription_active") === "true" ||
    localStorage.getItem("billing_status") === "active" ||
    Boolean(localStorage.getItem("play_subscription_token")) ||
    meta.subscription_status === "active"
  );
}

export function usePlayBilling() {
  const initialMeta = readLocalSubscriptionMetadata();
  const [plans, setPlans] = useState<SubscriptionPlan[]>(getCachedProductPlans);
  const [isPro, setIsPro] = useState(getInitialActiveState);
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus>(
    getInitialActiveState() ? "active" : initialMeta.subscription_status
  );
  const [subscriptionTier, setSubscriptionTier] = useState<string | null>(
    initialMeta.subscription_tier || localStorage.getItem("billing_plan_id") || (getInitialActiveState() ? "premium_monthly" : null)
  );
  const [subscriptionExpiresAt, setSubscriptionExpiresAt] = useState<string | null>(
    initialMeta.subscription_expires_at
  );
  const [loading, setLoading] = useState(false);
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applySubscriptionMeta = useCallback((active: boolean, meta?: ProfileSubscriptionRecord | null) => {
    const fallback = meta ?? readLocalSubscriptionMetadata();
    setIsPro(active);
    setSubscriptionStatus(active ? "active" : fallback.subscription_status === "active" ? "inactive" : fallback.subscription_status);
    setSubscriptionTier(active ? fallback.subscription_tier || localStorage.getItem("billing_plan_id") || "premium_monthly" : fallback.subscription_tier);
    setSubscriptionExpiresAt(active ? fallback.subscription_expires_at : fallback.subscription_expires_at);
  }, []);

  const checkSubscription = useCallback(async () => {
    const isOffline = typeof navigator !== "undefined" && navigator.onLine === false;
    if (isOffline) {
      const active = getInitialActiveState();
      applySubscriptionMeta(active, readLocalSubscriptionMetadata());
      return active;
    }

    setLoading(true);
    setError(null);
    try {
      const [playActive, profileMeta] = await Promise.all([
        hasActivePlaySubscription(),
        fetchProfileSubscription(),
      ]);

      const profileActive =
        profileMeta?.subscription_status === "active" &&
        (!profileMeta.subscription_expires_at ||
          new Date(profileMeta.subscription_expires_at).getTime() > Date.now());

      const active = playActive || profileActive || getInitialActiveState();
      applySubscriptionMeta(active, profileMeta);
      return active;
    } catch {
      const fallbackActive = getInitialActiveState();
      applySubscriptionMeta(fallbackActive, readLocalSubscriptionMetadata());
      return fallbackActive;
    } finally {
      setLoading(false);
    }
  }, [applySubscriptionMeta]);

  useEffect(() => {
    registerWindowBillingBridge();
    void checkSubscription();

    // Query Google Play product details for local pricing
    void queryProductDetailsAsync().then((fetched) => {
      if (fetched && fetched.length > 0) {
        setPlans(fetched);
      }
    });

    const handleUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ isPro?: boolean } & Partial<ProfileSubscriptionRecord>>).detail;
      if (detail && typeof detail.isPro === "boolean") {
        applySubscriptionMeta(detail.isPro, {
          subscription_status: detail.subscription_status || (detail.isPro ? "active" : "inactive"),
          subscription_tier: detail.subscription_tier ?? null,
          subscription_expires_at: detail.subscription_expires_at ?? null,
        });
      } else {
        void checkSubscription();
      }
    };

    const handleProductDetailsUpdated = (event: Event) => {
      const detail = (event as CustomEvent<SubscriptionPlan[]>).detail;
      if (detail && Array.isArray(detail)) {
        setPlans(detail);
      }
    };

    window.addEventListener(SUBSCRIPTION_UPDATED_EVENT, handleUpdated);
    window.addEventListener(PRODUCT_DETAILS_UPDATED_EVENT, handleProductDetailsUpdated);

    return () => {
      window.removeEventListener(SUBSCRIPTION_UPDATED_EVENT, handleUpdated);
      window.removeEventListener(PRODUCT_DETAILS_UPDATED_EVENT, handleProductDetailsUpdated);
    };
  }, [applySubscriptionMeta, checkSubscription]);

  const purchasePlan = useCallback(
    async (productId: string, basePlanId?: string): Promise<boolean> => {
      setPurchaseLoading(true);
      setError(null);
      try {
        const result = await buySubscription(productId, basePlanId);
        if (result && result.success) {
          applySubscriptionMeta(true, readLocalSubscriptionMetadata());
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
    [applySubscriptionMeta]
  );

  const cancelSub = useCallback(() => {
    resetPlaySubscription(true);
    setIsPro(false);
    setSubscriptionStatus("inactive");
    setSubscriptionTier(null);
    setSubscriptionExpiresAt(null);
  }, []);

  return {
    isPro,
    isSubscribed: isPro,
    subscriptionStatus,
    subscriptionTier,
    subscriptionExpiresAt,
    loading,
    purchaseLoading,
    error,
    plans,
    checkSubscription,
    purchasePlan,
    cancelSubscription: cancelSub,
    isAvailable: isPlayBillingAvailable(),
  };
}

export const useSubscription = usePlayBilling;
