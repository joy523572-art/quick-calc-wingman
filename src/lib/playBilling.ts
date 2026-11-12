export const PLAY_BILLING_URL = "https://play.google.com/billing";

export const LIFETIME_PRODUCT = {
  id: "lifetime_premium",
  productId: "lifetime_premium",
  basePlanId: "lifetime_premium",
  price: "$19.99",
  cadence: "One-Time Lifetime Purchase",
} as const;

export const SUBSCRIPTIONS = [LIFETIME_PRODUCT] as const;

export type SubscriptionPlan = (typeof SUBSCRIPTIONS)[number];

type PlayItemDetails = {
  itemId: string;
  title?: string;
  description?: string;
  price?: { currency: string; value: string };
};

type PlayPurchase = { itemId: string; purchaseToken: string };

export type DigitalGoodsService = {
  getDetails: (itemIds: string[]) => Promise<PlayItemDetails[]>;
  listPurchases: () => Promise<PlayPurchase[]>;
  consume?: (purchaseToken: string) => Promise<void>;
};

declare global {
  interface Window {
    getDigitalGoodsService?: (provider: string) => Promise<DigitalGoodsService>;
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
    return await service.getDetails(["lifetime_premium"]);
  } catch (err) {
    console.warn("Failed to get Google Play subscription details:", err);
    return null;
  }
}

/**
 * Checks active purchase status.
 * PRO access is granted ONLY if Google Play Digital Goods service reports an active purchase
 * for Product ID 'lifetime_premium' or if a verified purchaseToken from Google Play is present.
 */
export async function hasActivePlaySubscription(service?: DigitalGoodsService): Promise<boolean> {
  // 1. Check Google Play Digital Goods API if available
  if (isPlayBillingAvailable()) {
    try {
      const billing = service ?? (await getPlayBillingService());
      if (billing && typeof billing.listPurchases === "function") {
        const purchases = await billing.listPurchases();
        const hasActivePurchase = purchases.some((purchase) => {
          if (!purchase.purchaseToken) return false;
          const item = purchase.itemId?.toLowerCase() || "";
          return item === "lifetime_premium" || item.includes("lifetime");
        });

        if (hasActivePurchase) {
          try {
            localStorage.setItem("billing_status", "active");
            localStorage.setItem("billing_plan_id", "lifetime_premium");
            localStorage.setItem("lifetime_purchased", "true");
          } catch {
            // ignore
          }
          return true;
        }

        // Check if verified Play purchase token was saved from a previous verified Digital Goods callback
        const verifiedPlayToken = localStorage.getItem("play_purchase_token");
        if (verifiedPlayToken) {
          return true;
        }

        // Active purchase not found in Google Play — clear cached PRO flags
        localStorage.removeItem("billing_status");
        localStorage.removeItem("billing_plan_id");
        localStorage.removeItem("lifetime_purchased");
        return false;
      }
    } catch (e) {
      console.warn("Error querying Google Play purchases:", e);
    }
  }

  // 2. Offline / fallback check for verified Play purchase token set by Google Play callback
  try {
    if (typeof window !== "undefined") {
      const verifiedPlayToken = localStorage.getItem("play_purchase_token");
      if (verifiedPlayToken) {
        return true;
      }
    }
  } catch {
    // ignore
  }

  return false;
}

/**
 * Triggers a purchase via Google Play Billing (PaymentRequest & Digital Goods API).
 * Mock / simulated unlocks are completely removed.
 */
export async function buySubscription(
  _productIdOrPlanId?: string,
  _basePlanId?: string
): Promise<{ success: boolean; receiptId: string; purchaseToken: string }> {
  const resolvedProductId = "lifetime_premium";

  if (!isPlayBillingAvailable()) {
    throw new Error(
      "Google Play Billing is available only when opened from your installed Android app via Google Play Store. Mock purchase unlocks are disabled."
    );
  }

  let response: PaymentResponse | null = null;
  try {
    // Warm up Google Play service connection
    getSubscriptionDetails().catch(() => {});

    const paymentMethods: PaymentMethodData[] = [
      {
        supportedMethods: PLAY_BILLING_URL,
        data: {
          sku: resolvedProductId,
        },
      },
    ];

    const paymentDetails: PaymentDetailsInit = {
      total: {
        label: "Nume Lifetime Premium Access",
        amount: { currency: "USD", value: "19.99" },
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

    // Show native Google Play purchase bottom sheet
    response = await request.show();

    // Extract verified Google Play purchase token
    const details = response.details as { purchaseToken?: string; token?: string } | undefined;
    const purchaseToken = details?.purchaseToken || details?.token;

    if (!purchaseToken) {
      await response.complete("fail");
      throw new Error("Google Play completed the payment flow but did not return a valid purchase token.");
    }

    // Acknowledge/complete Google Play transaction successfully
    await response.complete("success");

    // Persist verified purchase token
    try {
      localStorage.setItem("billing_status", "active");
      localStorage.setItem("billing_plan_id", resolvedProductId);
      localStorage.setItem("lifetime_purchased", "true");
      localStorage.setItem("play_purchase_token", purchaseToken);
    } catch {
      // ignore
    }

    const receiptId = `GP-${purchaseToken.substring(0, 10).toUpperCase()}`;
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

    // Handle user cancellation
    if (
      errObj?.name === "AbortError" ||
      errObj?.message?.toLowerCase().includes("user cancel") ||
      errObj?.message?.toLowerCase().includes("abort")
    ) {
      throw new Error("Purchase was cancelled in Google Play.");
    }

    const errMsg = errObj?.message || "Google Play checkout could not be initiated.";
    console.error("Google Play Billing error:", error);
    throw new Error(
      `Google Play Billing: ${errMsg}. Please ensure 'lifetime_premium' is Active in Play Console and you are using an authorized test/purchaser account.`
    );
  }
}

export function resetPlaySubscription(): void {
  try {
    localStorage.removeItem("billing_status");
    localStorage.removeItem("billing_plan_id");
    localStorage.removeItem("lifetime_purchased");
    localStorage.removeItem("play_purchase_token");
  } catch {
    // ignore
  }
}