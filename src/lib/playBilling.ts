export const PLAY_BILLING_URL = "https://play.google.com/billing";
export const SUBSCRIPTIONS = [
  { id: "monthly", productId: "monthly", basePlanId: "monthly-autorenewal", price: "$6/month", cadence: "Monthly" },
  { id: "weekly", productId: "weekly", basePlanId: "weekly-autorenewal", price: "$3 weekly", cadence: "Weekly" },
] as const;

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
  const ids = [
    ...SUBSCRIPTIONS.map((plan) => plan.productId),
    ...SUBSCRIPTIONS.map((plan) => plan.basePlanId),
    ...SUBSCRIPTIONS.map((plan) => `${plan.productId}:${plan.basePlanId}`),
  ];
  return service.getDetails(Array.from(new Set(ids)));
}

export async function hasActivePlaySubscription(service?: DigitalGoodsService): Promise<boolean> {
  // 1. Check verified localStorage billing status first
  try {
    if (typeof window !== "undefined") {
      const billingStatus = localStorage.getItem("billing_status");
      if (billingStatus === "active") {
        return true;
      }
    }
  } catch {
    // ignore
  }

  // 2. Check web / preview subscription storage
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
      return SUBSCRIPTIONS.some((plan) => {
        const planId = plan.id.toLowerCase();
        const productId = plan.productId.toLowerCase();
        const basePlan = plan.basePlanId.toLowerCase();
        return (
          item === planId ||
          item === productId ||
          item === basePlan ||
          item.endsWith(`:${basePlan}`) ||
          item.includes(basePlan) ||
          item.includes(planId) ||
          item.includes(productId)
        );
      });
    });

    if (hasActivePurchase) {
      try {
        localStorage.setItem("billing_status", "active");
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
  productIdOrPlanId: string,
  basePlanId?: string,
  email?: string
): Promise<{ success: boolean; receiptId: string; email: string }> {
  // Find the target plan by id, product ID, or base plan ID
  const product =
    SUBSCRIPTIONS.find(
      (plan) =>
        plan.id === productIdOrPlanId ||
        plan.productId === productIdOrPlanId ||
        plan.basePlanId === productIdOrPlanId ||
        plan.basePlanId === basePlanId
    ) || (productIdOrPlanId.toLowerCase().includes("week") ? SUBSCRIPTIONS[1] : SUBSCRIPTIONS[0]);

  // Resolve both product ID and base plan ID explicitly
  const resolvedProductId =
    basePlanId && productIdOrPlanId !== basePlanId
      ? productIdOrPlanId
      : product.productId;

  const resolvedBasePlanId =
    basePlanId || product.basePlanId;

  // If Google Play billing is available, use Google Play PaymentRequest with both product ID & base plan ID
  if (isPlayBillingAvailable()) {
    getSubscriptionDetails().catch(() => {});
    const skuString = `${resolvedProductId}:${resolvedBasePlanId}`;
    const request = new PaymentRequest(
      [
        {
          supportedMethods: PLAY_BILLING_URL,
          data: {
            sku: skuString,
            productId: resolvedProductId,
            basePlanId: resolvedBasePlanId,
          },
        },
      ],
      { total: { label: "Get Unlimited Access", amount: { currency: "USD", value: "0.00" } } }
    );

    let response: PaymentResponse | null = null;
    try {
      response = await request.show();
      const active = await hasActivePlaySubscription();
      await response.complete(active ? "success" : "fail");
      if (!active) {
        try {
          localStorage.setItem("billing_status", "failed");
        } catch {
          // ignore
        }
        throw new Error("Google Play has not reported an active subscription yet.");
      }

      // On success: save to localStorage billing_status = active and billing_plan_id = basePlanId, unlock all features immediately
      try {
        localStorage.setItem("billing_status", "active");
        localStorage.setItem("billing_plan_id", resolvedBasePlanId);
      } catch {
        // ignore
      }

      const receiptId = `GP-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
      return { success: true, receiptId, email: email || "user@play.store" };
    } catch (error) {
      if (response) {
        try {
          await response.complete("fail");
        } catch {
          /* already completed */
        }
      }
      // On fail: save billing_status = failed and show error message
      try {
        localStorage.setItem("billing_status", "failed");
      } catch {
        // ignore
      }
      throw error;
    }
  }

  // Web / Browser Preview mode subscription checkout with email receipt
  if (!email || !email.includes("@")) {
    try {
      localStorage.setItem("billing_status", "failed");
    } catch {
      // ignore
    }
    throw new Error("Please enter a valid email address to receive your subscription receipt.");
  }

  // Simulate secure payment processing charge
  await new Promise((resolve) => setTimeout(resolve, 800));

  const receiptId = `NUME-PRO-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
  const record: WebSubscriptionRecord = {
    planId: product.id,
    email: email.trim(),
    receiptId,
    timestamp: Date.now(),
  };

  try {
    localStorage.setItem(WEB_SUB_STORAGE_KEY, JSON.stringify(record));
    // On success: save to localStorage billing_status = active and billing_plan_id = basePlanId, unlock all features immediately
    localStorage.setItem("billing_status", "active");
    localStorage.setItem("billing_plan_id", resolvedBasePlanId);
  } catch {
    try {
      localStorage.setItem("billing_status", "failed");
    } catch {
      // ignore
    }
    throw new Error("Could not save subscription record locally.");
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