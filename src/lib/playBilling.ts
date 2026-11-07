export const PLAY_BILLING_URL = "https://play.google.com/billing";
export const SUBSCRIPTIONS = [
  { id: "monthly", basePlanId: "monthly", price: "$6/month", cadence: "Monthly" },
  { id: "weekly", basePlanId: "weekly", price: "$3 weekly", cadence: "Weekly" },
] as const;

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
  return service.getDetails(SUBSCRIPTIONS.map((plan) => plan.id));
}

export async function hasActivePlaySubscription(service?: DigitalGoodsService) {
  const billing = service ?? await getPlayBillingService();
  const purchases = await billing.listPurchases();
  return purchases.some((purchase) => {
    if (!purchase.purchaseToken) return false;
    const item = purchase.itemId?.toLowerCase() || "";
    // Matches if itemId is equal to plan id, basePlanId, ends with :basePlanId or contains basePlanId
    return SUBSCRIPTIONS.some((plan) => {
      const planId = plan.id.toLowerCase();
      const basePlan = plan.basePlanId.toLowerCase();
      return (
        item === planId ||
        item === basePlan ||
        item.endsWith(`:${basePlan}`) ||
        item.includes(basePlan) ||
        item.includes(planId)
      );
    });
  });
}

export async function buySubscription(productId: string) {
  const product = SUBSCRIPTIONS.find(
    (plan) => plan.id === productId || plan.basePlanId === productId
  );
  if (!product) throw new Error("That subscription option is not available.");
  
  // Google Play Billing Digital Goods API: sku is basePlanId (weekly or monthly)
  const skuToPurchase = product.basePlanId;

  // Fire getSubscriptionDetails non-blockingly so the UI prompt shows immediately without delay
  getSubscriptionDetails().catch(() => {});

  const request = new PaymentRequest(
    [{ supportedMethods: PLAY_BILLING_URL, data: { sku: skuToPurchase } }],
    { total: { label: "Get Unlimited Access", amount: { currency: "USD", value: "0.00" } } },
  );
  const response = await request.show();
  try {
    const active = await hasActivePlaySubscription();
    await response.complete(active ? "success" : "fail");
    if (!active) throw new Error("Google Play has not reported an active subscription yet. Try restoring purchases in the Play Store app.");
    return true;
  } catch (error) {
    try { await response.complete("fail"); } catch { /* already completed */ }
    throw error;
  }
}