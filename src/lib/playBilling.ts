export const PLAY_BILLING_URL = "https://play.google.com/billing";

export const WEEKLY_PRODUCT = {
  id: "premium_weekly",
  productId: "premium_weekly",
  basePlanId: "weekly-autorenewal",
  price: "$3.00",
  cadence: "Weekly Reoccurring Subscription",
} as const;

export const MONTHLY_PRODUCT = {
  id: "premium_monthly",
  productId: "premium_monthly",
  basePlanId: "monthly-autorewal",
  price: "$6.00",
  cadence: "Monthly Reoccurring Subscription",
} as const;

export const SUBSCRIPTIONS = [WEEKLY_PRODUCT, MONTHLY_PRODUCT] as const;

export type SubscriptionPlan = (typeof SUBSCRIPTIONS)[number];

type PlayItemDetails = {
  itemId: string;
  title?: string;
  description?: string;
  price?: { currency: string; value: string };
};

type PlayPurchase = { itemId: string; purchaseToken: string; acknowledgeState?: string };

export type DigitalGoodsService = {
  getDetails: (itemIds: string[]) => Promise<PlayItemDetails[]>;
  listPurchases: () => Promise<PlayPurchase[]>;
  consume?: (purchaseToken: string) => Promise<void>;
  acknowledge?: (purchaseToken: string) => Promise<void>;
};

declare global {
  interface Window {
    getDigitalGoodsService?: (provider: string) => Promise<DigitalGoodsService>;
    triggerPurchase?: (productId: string, basePlanId: string) => Promise<boolean>;
    updateSubscriptionUI?: (isPro: boolean) => void;
  }
}

export const isPlayBillingAvailable = (): boolean =>
  typeof window !== "undefined" &&
  typeof window.getDigitalGoodsService === "function" &&
  typeof PaymentRequest !== "undefined";

export async function getPlayBillingService(): Promise<DigitalGoodsService | null> {
  if (!isPlayBillingAvailable() || !window.getDigitalGoodsService) {
    return null;
  }
  try {
    return await window.getDigitalGoodsService(PLAY_BILLING_URL);
  } catch (err) {
    console.warn("Google Play billing service could not be initialized:", err);
    return null;
  }
}

export async function getSubscriptionDetails(): Promise<PlayItemDetails[] | null> {
  const service = await getPlayBillingService();
  if (!service) return null;
  try {
    return await service.getDetails(["premium_weekly", "premium_monthly"]);
  } catch (err) {
    console.warn("Failed to get Google Play subscription details:", err);
    return null;
  }
}

export async function hasActivePlaySubscription(service?: DigitalGoodsService): Promise<boolean> {
  if (isPlayBillingAvailable()) {
    try {
      const billing = service ?? (await getPlayBillingService());
      if (billing && typeof billing.listPurchases === "function") {
        const purchases = await billing.listPurchases();
        const hasActivePurchase = purchases.some((purchase) => {
          if (!purchase.purchaseToken) return false;
          const item = purchase.itemId?.toLowerCase() || "";
          return (
            item === "premium_weekly" ||
            item === "premium_monthly" ||
            item.includes("premium") ||
            item.includes("weekly") ||
            item.includes("monthly")
          );
        });

        if (hasActivePurchase) {
          try {
            localStorage.setItem("billing_status", "active");
            localStorage.setItem("billing_plan_id", "premium_monthly");
            localStorage.setItem("subscription_active", "true");
          } catch {
            // ignore
          }
          return true;
        }

        const verifiedPlayToken = localStorage.getItem("play_subscription_token");
        if (verifiedPlayToken) {
          return true;
        }

        localStorage.removeItem("billing_status");
        localStorage.removeItem("billing_plan_id");
        localStorage.removeItem("subscription_active");
        return false;
      }
    } catch (e) {
      console.warn("Error querying Google Play subscriptions:", e);
    }
  }

  try {
    if (typeof window !== "undefined") {
      const verifiedPlayToken = localStorage.getItem("play_subscription_token");
      if (verifiedPlayToken) {
        return true;
      }
    }
  } catch {
    // ignore
  }

  return false;
}

export async function buySubscription(
  productId: string = "premium_weekly",
  basePlanId: string = "weekly-autorenewal"
): Promise<{ success: boolean; receiptId: string; purchaseToken: string }> {
  if (!isPlayBillingAvailable()) {
    throw new Error(
      "Google Play Billing reoccurring subscriptions are available only when opened from your installed Android app via Google Play Store."
    );
  }

  let response: PaymentResponse | null = null;
  try {
    getSubscriptionDetails().catch(() => {});

    const paymentMethods: PaymentMethodData[] = [
      {
        supportedMethods: PLAY_BILLING_URL,
        data: {
          sku: productId,
          basePlanId: basePlanId,
        },
      },
    ];

    const paymentDetails: PaymentDetailsInit = {
      total: {
        label: productId === "premium_monthly" ? "Monthly Subscription $6" : "Weekly Subscription $3",
        amount: { currency: "USD", value: productId === "premium_monthly" ? "6.00" : "3.00" },
      },
    };

    const request = new PaymentRequest(paymentMethods, paymentDetails);

    if (typeof request.canMakePayment === "function") {
      const canPay = await request.canMakePayment().catch(() => true);
      if (!canPay) {
        throw new Error(
          "Google Play Billing is not supported in this browser window. Please open the app from your installed Google Play application."
        );
      }
    }

    response = await request.show();

    const details = response.details as { purchaseToken?: string; token?: string } | undefined;
    const purchaseToken = details?.purchaseToken || details?.token;

    if (!purchaseToken) {
      await response.complete("fail");
      throw new Error("Google Play completed the payment flow but did not return a valid subscription purchase token.");
    }

    await response.complete("success");

    try {
      localStorage.setItem("billing_status", "active");
      localStorage.setItem("billing_plan_id", productId);
      localStorage.setItem("subscription_active", "true");
      localStorage.setItem("play_subscription_token", purchaseToken);
    } catch {
      // ignore
    }

    if (typeof window !== "undefined" && typeof window.updateSubscriptionUI === "function") {
      window.updateSubscriptionUI(true);
    }

    const receiptId = `GP-SUB-${purchaseToken.substring(0, 10).toUpperCase()}`;
    return {
      success: true,
      receiptId,
      purchaseToken,
    };
  } catch (error: unknown) {
    if (response) {
      try {
        await response.complete("fail");
      } catch {
        // ignore
      }
    }

    const errObj = error as { name?: string; message?: string } | undefined;

    if (
      errObj?.name === "AbortError" ||
      errObj?.message?.toLowerCase().includes("user cancel") ||
      errObj?.message?.toLowerCase().includes("abort")
    ) {
      throw new Error("Subscription purchase was cancelled in Google Play.");
    }

    const errMsg = errObj?.message || "Google Play subscription checkout could not be initiated.";
    console.error("Google Play Subscription error:", error);
    throw new Error(
      `Google Play Subscription: ${errMsg}. Please ensure '${productId}' is Active in Play Console and you are using an authorized test/purchaser account.`
    );
  }
}

// Bind window.triggerPurchase for native wrapper integration
if (typeof window !== "undefined") {
  window.triggerPurchase = async (productId: string, basePlanId: string): Promise<boolean> => {
    try {
      const result = await buySubscription(productId, basePlanId);
      return result.success;
    } catch (err) {
      console.error("triggerPurchase error:", err);
      return false;
    }
  };
}

export function resetPlaySubscription(): void {
  try {
    localStorage.removeItem("billing_status");
    localStorage.removeItem("billing_plan_id");
    localStorage.removeItem("subscription_active");
    localStorage.removeItem("play_subscription_token");
    if (typeof window !== "undefined" && typeof window.updateSubscriptionUI === "function") {
      window.updateSubscriptionUI(false);
    }
  } catch {
    // ignore
  }
}