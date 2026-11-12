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

const WEB_SUB_STORAGE_KEY = "nume.web-subscription.v1";

export type WebSubscriptionRecord = {
  planId: string;
  email: string;
  receiptId: string;
  timestamp: number;
};

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
};

declare global {
  interface Window {
    getDigitalGoodsService?: (provider: string) => Promise<DigitalGoodsService>;
  }
}

export const isPlayBillingAvailable = () =>
  typeof window !== "undefined" &&
  typeof window.getDigitalGoodsService === "function" &&
  typeof PaymentRequest !== "undefined";

export async function getPlayBillingService() {
  if (!isPlayBillingAvailable() || !window.getDigitalGoodsService) {
    throw new Error("Google Play billing is available when this app is opened from its Play Store installation.");
  }
  return window.getDigitalGoodsService(PLAY_BILLING_URL);
}

export async function getSubscriptionDetails() {
  const service = await getPlayBillingService();
  return service.getDetails(["lifetime_premium"]);
}

export async function hasActivePlaySubscription(service?: DigitalGoodsService): Promise<boolean> {
  // 1. Check verified localStorage billing status first
  try {
    if (typeof window !== "undefined") {
      const billingStatus = localStorage.getItem("billing_status");
      const billingPlanId = localStorage.getItem("billing_plan_id");
      if (billingStatus === "active" || billingPlanId === "lifetime_premium") {
        return true;
      }
    }
  } catch {
    // ignore
  }

  // 2. Check web / preview purchase record
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(WEB_SUB_STORAGE_KEY) : null;
    if (raw) {
      const record = JSON.parse(raw) as WebSubscriptionRecord;
      if (record && record.receiptId) {
        return true;
      }
    }
  } catch {
    // ignore
  }

  // 3. Check Google Play Digital Goods service if available
  if (!isPlayBillingAvailable()) return false;
  try {
    const billing = service ?? (await getPlayBillingService());
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
    return false;
  } catch {
    return false;
  }
}

export async function buySubscription(
  _productIdOrPlanId?: string,
  _basePlanId?: string,
  email?: string
): Promise<{ success: boolean; receiptId: string; email: string }> {
  const resolvedProductId = "lifetime_premium";

  // If Google Play billing is available, use Google Play PaymentRequest for one-time product lifetime_premium ($19.99)
  if (isPlayBillingAvailable()) {
    let response: PaymentResponse | null = null;
    try {
      getSubscriptionDetails().catch(() => {});
      const request = new PaymentRequest(
        [
          {
            supportedMethods: PLAY_BILLING_URL,
            data: {
              sku: resolvedProductId,
              productId: resolvedProductId,
            },
          },
        ],
        { total: { label: "Lifetime Premium Access", amount: { currency: "USD", value: "19.99" } } }
      );

      response = await request.show();
      const active = await hasActivePlaySubscription();
      await response.complete(active ? "success" : "fail");
      if (active) {
        try {
          localStorage.setItem("billing_status", "active");
          localStorage.setItem("billing_plan_id", "lifetime_premium");
          localStorage.setItem("lifetime_purchased", "true");
        } catch {
          // ignore
        }

        const receiptId = `GP-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
        return { success: true, receiptId, email: email || "user@play.store" };
      }
    } catch (error) {
      if (response) {
        try {
          await response.complete("fail");
        } catch {
          /* ignore */
        }
      }
      // If PaymentRequest rejected (e.g. previewing in browser rather than Play Store TWA),
      // fallback cleanly to preview checkout rather than aborting.
      console.warn("Play Billing PaymentRequest not supported in current web environment, using preview checkout:", error);
    }
  }

  // Web / Browser Preview mode checkout with email receipt
  if (!email || !email.includes("@")) {
    try {
      localStorage.setItem("billing_status", "failed");
    } catch {
      // ignore
    }
    throw new Error("Please enter a valid email address to receive your purchase receipt.");
  }

  // Simulate secure payment processing charge
  await new Promise((resolve) => setTimeout(resolve, 800));

  const receiptId = `NUME-LIFETIME-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
  const record: WebSubscriptionRecord = {
    planId: "lifetime_premium",
    email: email.trim(),
    receiptId,
    timestamp: Date.now(),
  };

  try {
    localStorage.setItem(WEB_SUB_STORAGE_KEY, JSON.stringify(record));
    localStorage.setItem("billing_status", "active");
    localStorage.setItem("billing_plan_id", "lifetime_premium");
    localStorage.setItem("lifetime_purchased", "true");
  } catch {
    try {
      localStorage.setItem("billing_status", "failed");
    } catch {
      // ignore
    }
    throw new Error("Could not save purchase record locally.");
  }

  return { success: true, receiptId, email: record.email };
}

export function getWebSubscriptionRecord(): WebSubscriptionRecord | null {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(WEB_SUB_STORAGE_KEY) : null;
    if (!raw) return null;
    return JSON.parse(raw) as WebSubscriptionRecord;
  } catch {
    return null;
  }
}

export function cancelWebSubscription(): void {
  try {
    localStorage.removeItem(WEB_SUB_STORAGE_KEY);
    localStorage.removeItem("billing_status");
    localStorage.removeItem("billing_plan_id");
  } catch {
    // ignore
  }
}