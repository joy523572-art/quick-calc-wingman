export const PLAY_BILLING_URL = "https://play.google.com/billing";
export const SUBSCRIPTIONS = [
  { id: "premium_monthly", price: "$6/month", cadence: "Monthly" },
  { id: "premium_weekly", price: "$3 weekly", cadence: "Weekly" },
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
  return purchases.some((purchase) => SUBSCRIPTIONS.some((plan) => purchase.itemId === plan.id) && Boolean(purchase.purchaseToken));
}

export async function buySubscription(productId: string) {
  const product = SUBSCRIPTIONS.find((plan) => plan.id === productId);
  if (!product) throw new Error("That subscription option is not available.");
  await getSubscriptionDetails();
  const request = new PaymentRequest(
    [{ supportedMethods: PLAY_BILLING_URL, data: { sku: product.id } }],
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