import {
  clearLocalSubscriptionMetadata,
  computeSubscriptionExpiresAt,
  ProfileSubscriptionRecord,
  readLocalSubscriptionMetadata,
  SubscriptionStatus,
  syncSubscriptionToProfile,
} from "./subscriptionSync";

export const PLAY_BILLING_URL = "https://play.google.com/billing";
export const SUBSCRIPTION_TAG = "Unlock All Features";
export const PLAY_PACKAGE_NAME = "scientific.calculator.cm";
export const PLAY_MANAGE_SUBSCRIPTIONS_URL = `https://play.google.com/store/account/subscriptions?package=${PLAY_PACKAGE_NAME}`;

export const PRODUCT_DETAILS_CACHE_KEY = "nume.product_details.v2";
export const PRODUCT_DETAILS_UPDATED_EVENT = "nume:product-details-updated";

export interface SubscriptionPlan {
  id: string;
  productId: string;
  basePlanId: string;
  title: string;
  formattedPrice: string; // e.g. "₦1,500", "₦500", "$6.00", "$3.00"
  price?: string; // backwards-compatible alias for formattedPrice
  shortPrice?: string; // backwards-compatible alias
  priceCurrencyCode?: string;
  priceAmountMicros?: number;
  cadence: string;
}

export const WEEKLY_PRODUCT: SubscriptionPlan = {
  id: "premium_weekly",
  productId: "premium_weekly",
  basePlanId: "weekly-autorenewal",
  title: "Weekly Subscription",
  formattedPrice: "$3.00",
  price: "$3.00",
  shortPrice: "$3.00",
  cadence: "Weekly Reoccurring Subscription",
};

export const MONTHLY_PRODUCT: SubscriptionPlan = {
  id: "premium_monthly",
  productId: "premium_monthly",
  basePlanId: "monthly-autorewal",
  title: "Monthly Subscription",
  formattedPrice: "$6.00",
  price: "$6.00",
  shortPrice: "$6.00",
  cadence: "Monthly Reoccurring Subscription",
};

export const SUBSCRIPTIONS: SubscriptionPlan[] = [MONTHLY_PRODUCT, WEEKLY_PRODUCT];

export function getCachedProductPlans(): SubscriptionPlan[] {
  if (typeof window === "undefined") {
    return [MONTHLY_PRODUCT, WEEKLY_PRODUCT];
  }
  try {
    const raw = localStorage.getItem(PRODUCT_DETAILS_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  return [MONTHLY_PRODUCT, WEEKLY_PRODUCT];
}

export function saveCachedProductPlans(plans: SubscriptionPlan[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PRODUCT_DETAILS_CACHE_KEY, JSON.stringify(plans));
  } catch {
    // ignore
  }
}

export type PlayItemDetails = {
  itemId?: string;
  productId?: string;
  title?: string;
  description?: string;
  price?: { currency: string; value: string };
  formattedPrice?: string;
  subscriptionOfferDetails?: Array<{
    pricingPhases?: {
      pricingPhaseList?: Array<{
        formattedPrice?: string;
        priceAmountMicros?: number;
        priceCurrencyCode?: string;
      }>;
    };
  }>;
  oneTimePurchaseOfferDetails?: {
    formattedPrice?: string;
    priceAmountMicros?: number;
    priceCurrencyCode?: string;
  };
};

export type PlayPurchase = {
  itemId: string;
  purchaseToken: string;
  acknowledgeState?: "acknowledged" | "unacknowledged" | string;
  purchaseState?: string | number;
  isAcknowledged?: boolean;
};

export type NativeSubscriptionPayload = {
  isSubscribed?: boolean;
  isPro?: boolean;
  isPremium?: boolean;
  premium_unlimited?: boolean;
  status?: string;
  subscriptionStatus?: string;
  subscription_status?: string;
  productId?: string;
  tier?: string;
  purchaseToken?: string;
  expiresAt?: string;
  purchaseState?: string | number;
  isAcknowledged?: boolean;
};

export type DigitalGoodsService = {
  getDetails: (itemIds: string[]) => Promise<PlayItemDetails[]>;
  listPurchases: () => Promise<PlayPurchase[]>;
  consume?: (purchaseToken: string) => Promise<void>;
  acknowledge?: (purchaseToken: string) => Promise<void>;
};

export type NativeAndroidBillingBridge = {
  triggerPurchase?: (productId: string, basePlanId: string) => boolean | Promise<boolean> | void;
  purchase?: (productId: string, basePlanId: string) => boolean | Promise<boolean> | void;
  acknowledgePurchase?: (purchaseToken: string) => boolean | Promise<boolean> | void;
  queryPurchases?: () => void | Promise<PlayPurchase[]>;
  queryProductDetailsAsync?: () => Promise<PlayItemDetails[] | unknown>;
  getProductDetails?: () => Promise<PlayItemDetails[] | unknown>;
  openSubscriptionManagement?: () => void;
};

declare global {
  interface Window {
    getDigitalGoodsService?: (provider: string) => Promise<DigitalGoodsService>;
    AndroidBilling?: NativeAndroidBillingBridge;
    Android?: NativeAndroidBillingBridge;
    triggerPurchase?: (productId: string, basePlanId?: string) => Promise<boolean>;
    updateSubscriptionUI?: (payloadOrIsPro: boolean | NativeSubscriptionPayload) => void;
    onPurchasesUpdated?: (purchases: PlayPurchase | PlayPurchase[] | null | undefined) => Promise<void>;
    updateProductDetails?: (details: unknown) => void;
    setProductDetails?: (details: unknown) => void;
    queryProductDetailsAsync?: () => Promise<SubscriptionPlan[]>;
  }
}

export const SUBSCRIPTION_UPDATED_EVENT = "nume:subscription-updated";
export const TRIGGER_PURCHASE_EVENT = "nume:trigger-purchase";

const VALID_PRODUCT_IDS = new Set(["premium_weekly", "premium_monthly"]);

function isValidSubscriptionItem(itemId?: string): boolean {
  if (!itemId) return false;
  const normalized = itemId.toLowerCase();
  return (
    VALID_PRODUCT_IDS.has(normalized) ||
    normalized === "premium_weekly" ||
    normalized === "premium_monthly"
  );
}

function isPurchaseStatePurchased(state?: string | number): boolean {
  if (state === undefined || state === null) return true; // Digital Goods listPurchases returns active owned purchases
  if (typeof state === "number") return state === 1; // Google Play Billing PurchaseState.PURCHASED = 1
  return state.toUpperCase() === "PURCHASED";
}

function isPurchaseAlreadyAcknowledged(purchase: PlayPurchase): boolean {
  if (typeof purchase.isAcknowledged === "boolean") {
    return purchase.isAcknowledged;
  }
  if (typeof purchase.acknowledgeState === "string") {
    return purchase.acknowledgeState.toLowerCase() === "acknowledged";
  }
  return false;
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
    console.warn("[PlayBilling] Google Play billing service could not be initialized:", err);
    return null;
  }
}

/**
 * Parses raw product details from Android queryProductDetailsAsync or Digital Goods getDetails
 * and updates local cache & dispatches event.
 */
export function parseAndApplyProductDetails(rawList: unknown): SubscriptionPlan[] {
  if (!rawList) return getCachedProductPlans();

  let list: unknown[] = [];
  if (Array.isArray(rawList)) {
    list = rawList;
  } else if (typeof rawList === "object" && rawList !== null) {
    list = Object.values(rawList as Record<string, unknown>);
  }

  const currentPlans = getCachedProductPlans();
  const updatedPlans = currentPlans.map((plan) => {
    const match = list.find((item) => {
      if (!item || typeof item !== "object") return false;
      const rec = item as Record<string, unknown>;
      const id = String(rec.productId || rec.itemId || rec.id || "").toLowerCase();
      return id === plan.productId.toLowerCase() || id === plan.id.toLowerCase();
    }) as Record<string, unknown> | undefined;

    if (!match) return plan;

    let formattedPrice = plan.formattedPrice;
    let priceAmountMicros = plan.priceAmountMicros;
    let priceCurrencyCode = plan.priceCurrencyCode;

    // Direct formattedPrice (e.g. from Android wrapper or formatted payload)
    if (typeof match.formattedPrice === "string" && match.formattedPrice.trim()) {
      formattedPrice = match.formattedPrice.trim();
    }
    // SubscriptionOfferDetails from Google Play Billing queryProductDetailsAsync
    else if (Array.isArray(match.subscriptionOfferDetails) && match.subscriptionOfferDetails.length > 0) {
      const firstOffer = match.subscriptionOfferDetails[0] as Record<string, unknown>;
      const pricingPhases = firstOffer?.pricingPhases as Record<string, unknown> | undefined;
      const phasesList = pricingPhases?.pricingPhaseList as Array<Record<string, unknown>> | undefined;
      const firstPhase = phasesList?.[0];
      if (typeof firstPhase?.formattedPrice === "string" && firstPhase.formattedPrice.trim()) {
        formattedPrice = firstPhase.formattedPrice.trim();
      }
      if (typeof firstPhase?.priceAmountMicros === "number") {
        priceAmountMicros = firstPhase.priceAmountMicros;
      }
      if (typeof firstPhase?.priceCurrencyCode === "string") {
        priceCurrencyCode = firstPhase.priceCurrencyCode;
      }
    }
    // OneTimePurchaseOfferDetails
    else if (match.oneTimePurchaseOfferDetails && typeof match.oneTimePurchaseOfferDetails === "object") {
      const otp = match.oneTimePurchaseOfferDetails as Record<string, unknown>;
      if (typeof otp.formattedPrice === "string" && otp.formattedPrice.trim()) {
        formattedPrice = otp.formattedPrice.trim();
      }
      if (typeof otp.priceAmountMicros === "number") {
        priceAmountMicros = otp.priceAmountMicros;
      }
      if (typeof otp.priceCurrencyCode === "string") {
        priceCurrencyCode = otp.priceCurrencyCode;
      }
    }
    // Digital Goods price: { currency, value }
    else if (match.price && typeof match.price === "object") {
      const p = match.price as Record<string, unknown>;
      const cur = String(p.currency || "");
      const val = Number(p.value);
      if (cur && !isNaN(val)) {
        try {
          formattedPrice = new Intl.NumberFormat(undefined, {
            style: "currency",
            currency: cur,
          }).format(val);
        } catch {
          formattedPrice = `${cur} ${val}`;
        }
        priceCurrencyCode = cur;
      }
    }

    return {
      ...plan,
      formattedPrice,
      price: formattedPrice,
      shortPrice: formattedPrice,
      priceAmountMicros,
      priceCurrencyCode,
    };
  });

  saveCachedProductPlans(updatedPlans);

  // Keep static exported array synchronized
  if (updatedPlans[0]) Object.assign(MONTHLY_PRODUCT, updatedPlans[0]);
  if (updatedPlans[1]) Object.assign(WEEKLY_PRODUCT, updatedPlans[1]);

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(PRODUCT_DETAILS_UPDATED_EVENT, { detail: updatedPlans })
    );
  }

  return updatedPlans;
}

/**
 * Queries Google Play Billing for product details (prices, currency) using queryProductDetailsAsync
 * or Digital Goods getDetails. Returns localized formattedPrice for countries like Nigeria (₦500 / ₦1500)
 * or defaults for other countries.
 */
export async function queryProductDetailsAsync(): Promise<SubscriptionPlan[]> {
  // 1. Check native Android wrapper bridge
  const bridge = typeof window !== "undefined" ? (window.AndroidBilling ?? window.Android) : undefined;
  if (bridge) {
    if (typeof bridge.queryProductDetailsAsync === "function") {
      try {
        const nativeDetails = await bridge.queryProductDetailsAsync();
        if (nativeDetails) {
          return parseAndApplyProductDetails(nativeDetails);
        }
      } catch (err) {
        console.warn("[PlayBilling] Error in AndroidBilling.queryProductDetailsAsync:", err);
      }
    }
    if (typeof bridge.getProductDetails === "function") {
      try {
        const nativeDetails = await bridge.getProductDetails();
        if (nativeDetails) {
          return parseAndApplyProductDetails(nativeDetails);
        }
      } catch (err) {
        console.warn("[PlayBilling] Error in AndroidBilling.getProductDetails:", err);
      }
    }
  }

  // 2. Check Digital Goods API
  if (isPlayBillingAvailable()) {
    try {
      const details = await getSubscriptionDetails();
      if (details && details.length > 0) {
        return parseAndApplyProductDetails(details);
      }
    } catch (err) {
      console.warn("[PlayBilling] Failed to query product details via Digital Goods:", err);
    }
  }

  return getCachedProductPlans();
}

export const getSubscriptionDetails = async (): Promise<PlayItemDetails[] | null> => {
  const service = await getPlayBillingService();
  if (!service) return null;
  try {
    return await service.getDetails(["premium_monthly", "premium_weekly"]);
  } catch (err) {
    console.warn("[PlayBilling] Failed to get Google Play subscription details:", err);
    return null;
  }
};

/**
 * Acknowledges an unacknowledged purchase token via Digital Goods API or native Android bridge,
 * with explicit success and failure logs.
 */
export async function acknowledgePlayPurchase(
  purchaseToken: string,
  productId: string,
  service?: DigitalGoodsService | null
): Promise<boolean> {
  if (!purchaseToken) {
    console.warn("[PlayBilling] Acknowledge skipped: missing purchaseToken", { productId });
    return false;
  }

  try {
    const billing = service ?? (await getPlayBillingService());
    if (billing && typeof billing.acknowledge === "function") {
      await billing.acknowledge(purchaseToken);
      console.info("[PlayBilling] Acknowledge success via DigitalGoodsService", {
        productId,
        tokenPrefix: purchaseToken.slice(0, 8),
      });
      return true;
    }

    const bridge = typeof window !== "undefined" ? (window.AndroidBilling ?? window.Android) : undefined;
    if (bridge && typeof bridge.acknowledgePurchase === "function") {
      await bridge.acknowledgePurchase(purchaseToken);
      console.info("[PlayBilling] Acknowledge success via AndroidBilling bridge", {
        productId,
        tokenPrefix: purchaseToken.slice(0, 8),
      });
      return true;
    }

    console.info("[PlayBilling] Acknowledge not exposed on web DigitalGoodsService (handled by Play PaymentResponse.complete or native wrapper)", {
      productId,
      tokenPrefix: purchaseToken.slice(0, 8),
    });
    return true;
  } catch (err) {
    console.error("[PlayBilling] Acknowledge failure", {
      productId,
      tokenPrefix: purchaseToken.slice(0, 8),
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

function persistGrantedSubscription(
  productId: string,
  purchaseToken?: string,
  expiresAt?: string
): ProfileSubscriptionRecord {
  const normalizedTier =
    productId === "premium_weekly" || productId === "premium_monthly"
      ? productId
      : "premium_monthly";
  const resolvedExpiresAt = expiresAt || computeSubscriptionExpiresAt(normalizedTier);

  try {
    localStorage.setItem("billing_status", "active");
    localStorage.setItem("billing_plan_id", normalizedTier);
    localStorage.setItem("subscription_active", "true");
    localStorage.setItem("isPremium", "true");
    if (purchaseToken) {
      localStorage.setItem("play_subscription_token", purchaseToken);
    }
  } catch {
    // ignore storage access issues
  }

  const record: ProfileSubscriptionRecord = {
    subscription_status: "active",
    subscription_tier: normalizedTier,
    subscription_expires_at: resolvedExpiresAt,
  };

  void syncSubscriptionToProfile(record);
  return record;
}

function notifySubscriptionUpdated(isPro: boolean, record?: ProfileSubscriptionRecord): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(SUBSCRIPTION_UPDATED_EVENT, {
      detail: {
        isPro,
        isSubscribed: isPro,
        ...(record ?? readLocalSubscriptionMetadata()),
      },
    })
  );
}

export interface BackendVerificationResult {
  active: boolean;
  status?: SubscriptionStatus;
  productId?: string;
  expiresAt?: string | null;
  acknowledged?: boolean;
}

/**
 * Verifies an active Google Play purchase token against the Supabase Edge Function
 * (`verify-play-subscription`, backed by GOOGLE_SERVICE_ACCOUNT_JSON) when configured and online.
 * Returns null if offline, unconfigured, or temporarily unreachable so Play Billing client flow continues cleanly.
 */
export async function verifyPlayPurchaseWithBackend(
  purchaseToken: string,
  productId?: string
): Promise<BackendVerificationResult | null> {
  if (!purchaseToken) return null;
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return null;
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return null;
  }

  try {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data, error } = await supabase.functions.invoke("verify-play-subscription", {
      body: {
        purchaseToken,
        productId: productId || "premium_monthly",
        packageName: PLAY_PACKAGE_NAME,
        acknowledgeIfNeeded: true,
      },
    });

    if (error || !data || typeof (data as BackendVerificationResult).active !== "boolean") {
      return null;
    }

    return data as BackendVerificationResult;
  } catch (err) {
    console.warn("[PlayBilling] Backend verification skipped or unavailable:", err);
    return null;
  }
}

/**
 * Grants subscription access when a verified Play Billing purchase arrives
 * (either from Digital Goods API or native wrapper onPurchasesUpdated),
 * and acknowledges the purchase if not yet acknowledged.
 */
export async function processVerifiedPlayPurchase(
  purchase: PlayPurchase,
  service?: DigitalGoodsService | null
): Promise<boolean> {
  if (!purchase.purchaseToken || !isPurchaseStatePurchased(purchase.purchaseState)) {
    return false;
  }

  const productId = isValidSubscriptionItem(purchase.itemId)
    ? purchase.itemId
    : "premium_monthly";

  const record = persistGrantedSubscription(productId, purchase.purchaseToken);

  if (!isPurchaseAlreadyAcknowledged(purchase)) {
    await acknowledgePlayPurchase(purchase.purchaseToken, productId, service);
  }

  void verifyPlayPurchaseWithBackend(purchase.purchaseToken, productId).then((verified) => {
    if (verified && verified.active === false) {
      resetPlaySubscription(true, verified.status || "cancelled");
    } else if (verified?.active && verified.expiresAt) {
      const updated = persistGrantedSubscription(
        verified.productId || productId,
        purchase.purchaseToken,
        verified.expiresAt
      );
      notifySubscriptionUpdated(true, updated);
    }
  });

  notifySubscriptionUpdated(true, record);
  return true;
}

const ENTITLEMENT_STORAGE_KEYS = [
  "billing_status",
  "billing_plan_id",
  "subscription_active",
  "isPremium",
  "premium_unlimited",
  "lifetime_purchased",
  "nume.web-subscription.v1",
  "play_subscription_token",
] as const;

export function clearLocalEntitlementKeys(): void {
  if (typeof window === "undefined") return;
  try {
    for (const key of ENTITLEMENT_STORAGE_KEYS) {
      localStorage.removeItem(key);
    }
    clearLocalSubscriptionMetadata();
  } catch {
    // ignore storage issues
  }
}

export function isLocalSubscriptionExpired(): boolean {
  const meta = readLocalSubscriptionMetadata();
  if (
    meta.subscription_status === "cancelled" ||
    meta.subscription_status === "expired"
  ) {
    return true;
  }
  if (meta.subscription_expires_at) {
    const expiryMs = new Date(meta.subscription_expires_at).getTime();
    if (!Number.isNaN(expiryMs) && expiryMs <= Date.now()) {
      return true;
    }
  }
  return false;
}

export function hasLocalActiveEntitlement(): boolean {
  if (typeof window === "undefined") return false;
  if (isLocalSubscriptionExpired()) {
    clearLocalEntitlementKeys();
    return false;
  }
  const meta = readLocalSubscriptionMetadata();
  const premiumUnlimited = localStorage.getItem("premium_unlimited");
  return (
    localStorage.getItem("isPremium") === "true" ||
    premiumUnlimited === "true" ||
    premiumUnlimited === "active" ||
    localStorage.getItem("subscription_active") === "true" ||
    localStorage.getItem("billing_status") === "active" ||
    Boolean(localStorage.getItem("play_subscription_token")) ||
    meta.subscription_status === "active"
  );
}

/**
 * Checks Google Play Digital Goods API or native Android billing for active subscriptions on startup
 * and acknowledges any unacknowledged PURCHASED items.
 * If cancelled/expired in Google Play, automatically revokes local premium_unlimited & PRO state.
 * If offline, uses saved unexpired subscription status from local storage without calling Google Play Billing.
 */
export async function hasActivePlaySubscription(service?: DigitalGoodsService): Promise<boolean> {
  const isOffline = typeof navigator !== "undefined" && navigator.onLine === false;

  if (isOffline) {
    return hasLocalActiveEntitlement();
  }

  if (isPlayBillingAvailable()) {
    try {
      const billing = service ?? (await getPlayBillingService());
      if (billing && typeof billing.listPurchases === "function") {
        const purchases = await billing.listPurchases();
        const activePurchase = purchases.find(
          (purchase) =>
            Boolean(purchase.purchaseToken) &&
            isValidSubscriptionItem(purchase.itemId) &&
            isPurchaseStatePurchased(purchase.purchaseState)
        );

        if (activePurchase) {
          await processVerifiedPlayPurchase(activePurchase, billing);
          return true;
        }

        // Google Play confirmed no active subscription (cancelled/expired/refunded):
        // automatically revoke local entitlement immediately with no manual button needed.
        resetPlaySubscription(true, "cancelled");
        return false;
      }
    } catch (e) {
      console.warn("[PlayBilling] Error querying Google Play subscriptions (falling back to saved local status):", e);
      return hasLocalActiveEntitlement();
    }
  }

  // Check native Android bridge queryPurchases if it returns an array of purchases
  const nativeBridge =
    typeof window !== "undefined" ? (window.AndroidBilling ?? window.Android) : undefined;
  if (nativeBridge && typeof nativeBridge.queryPurchases === "function") {
    try {
      const nativePurchases = await Promise.resolve(nativeBridge.queryPurchases());
      if (Array.isArray(nativePurchases)) {
        const activeNative = nativePurchases.find(
          (purchase) =>
            Boolean(purchase.purchaseToken) &&
            isValidSubscriptionItem(purchase.itemId) &&
            isPurchaseStatePurchased(purchase.purchaseState)
        );
        if (activeNative) {
          await processVerifiedPlayPurchase(activeNative, null);
          return true;
        }
        resetPlaySubscription(true, "cancelled");
        return false;
      }
    } catch (e) {
      console.warn("[PlayBilling] Error querying native Android purchases:", e);
    }
  }

  const storedToken =
    typeof window !== "undefined" ? localStorage.getItem("play_subscription_token") : null;
  const storedTier =
    typeof window !== "undefined" ? localStorage.getItem("billing_plan_id") || undefined : undefined;
  if (storedToken) {
    const backendStatus = await verifyPlayPurchaseWithBackend(storedToken, storedTier);
    if (backendStatus && backendStatus.active === false) {
      resetPlaySubscription(true, backendStatus.status || "cancelled");
      return false;
    }
    if (backendStatus && backendStatus.active === true) {
      persistGrantedSubscription(
        backendStatus.productId || storedTier || "premium_monthly",
        storedToken,
        backendStatus.expiresAt || undefined
      );
      return true;
    }
  }

  return hasLocalActiveEntitlement();
}

export async function buySubscription(
  productId: string = "premium_monthly",
  basePlanId: string = productId === "premium_weekly" ? "weekly-autorenewal" : "monthly-autorewal"
): Promise<{ success: boolean; receiptId: string; purchaseToken: string }> {
  const nativeBridge =
    typeof window !== "undefined" ? (window.AndroidBilling ?? window.Android) : undefined;

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(TRIGGER_PURCHASE_EVENT, {
        detail: { productId, basePlanId },
      })
    );
  }

  if (!isPlayBillingAvailable()) {
    if (nativeBridge && (nativeBridge.triggerPurchase || nativeBridge.purchase)) {
      const fn = nativeBridge.triggerPurchase || nativeBridge.purchase;
      const handled = await Promise.resolve(fn?.(productId, basePlanId));
      if (handled) {
        return {
          success: true,
          receiptId: `GP-NATIVE-${productId.toUpperCase()}`,
          purchaseToken: localStorage.getItem("play_subscription_token") || "native-pending",
        };
      }
    }
    throw new Error(
      "Google Play Billing reoccurring subscriptions are available only when opened from your installed Android app via Google Play Store."
    );
  }

  let response: PaymentResponse | null = null;
  try {
    const plans = getCachedProductPlans();
    const matchedPlan = plans.find((p) => p.productId === productId || p.id === productId);

    const paymentMethods: PaymentMethodData[] = [
      {
        supportedMethods: PLAY_BILLING_URL,
        data: {
          sku: productId,
          basePlanId,
        },
      },
    ];

    const paymentDetails: PaymentDetailsInit = {
      total: {
        label: matchedPlan?.title || (productId === "premium_monthly" ? "Monthly Subscription" : "Weekly Subscription"),
        amount: {
          currency: matchedPlan?.priceCurrencyCode || "USD",
          value: matchedPlan?.priceAmountMicros
            ? (matchedPlan.priceAmountMicros / 1000000).toFixed(2)
            : productId === "premium_monthly" ? "6.00" : "3.00",
        },
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

    const details = response.details as
      | { purchaseToken?: string; token?: string; isAcknowledged?: boolean }
      | undefined;
    const purchaseToken = details?.purchaseToken || details?.token;

    if (!purchaseToken) {
      await response.complete("fail");
      throw new Error(
        "Google Play completed the payment flow but did not return a valid subscription purchase token."
      );
    }

    await response.complete("success");

    const record = persistGrantedSubscription(productId, purchaseToken);

    if (details?.isAcknowledged === false) {
      await acknowledgePlayPurchase(purchaseToken, productId);
    }

    notifySubscriptionUpdated(true, record);

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

    const errMsg =
      errObj?.message || "Google Play subscription checkout could not be initiated.";
    console.error("[PlayBilling] Subscription error:", error);
    throw new Error(
      `Google Play Subscription: ${errMsg}. Please ensure '${productId}' (${basePlanId}) is Active in Play Console and you are using an authorized account.`
    );
  }
}

export function resetPlaySubscription(
  notify = true,
  status: SubscriptionStatus = "inactive"
): void {
  try {
    clearLocalEntitlementKeys();

    void syncSubscriptionToProfile({
      subscription_status: status,
      subscription_tier: null,
      subscription_expires_at: null,
    });

    if (notify) {
      notifySubscriptionUpdated(false, {
        subscription_status: status,
        subscription_tier: null,
        subscription_expires_at: null,
      });
    }
  } catch {
    // ignore
  }
}

/**
 * Registers clean JavaScript interfaces on window so the native Android wrapper
 * can listen for checkout clicks (`window.triggerPurchase`) and push verified
 * purchase updates (`window.updateSubscriptionUI`, `window.onPurchasesUpdated`).
 */
export function registerWindowBillingBridge(): void {
  if (typeof window === "undefined") return;

  window.triggerPurchase = async (
    productId: string = "premium_monthly",
    basePlanId: string = productId === "premium_weekly" ? "weekly-autorenewal" : "monthly-autorewal"
  ): Promise<boolean> => {
    try {
      const result = await buySubscription(productId, basePlanId);
      return result.success;
    } catch (err) {
      console.error("[PlayBilling] triggerPurchase error:", err);
      return false;
    }
  };

  window.updateSubscriptionUI = (payloadOrIsPro: boolean | NativeSubscriptionPayload): void => {
    if (typeof payloadOrIsPro === "boolean") {
      if (payloadOrIsPro) {
        const current = readLocalSubscriptionMetadata();
        const productId = current.subscription_tier || localStorage.getItem("billing_plan_id") || "premium_monthly";
        const record = persistGrantedSubscription(productId, localStorage.getItem("play_subscription_token") || undefined, current.subscription_expires_at || undefined);
        notifySubscriptionUpdated(true, record);
      } else {
        resetPlaySubscription(true, "cancelled");
      }
      return;
    }

    const statusStr = String(
      payloadOrIsPro.subscription_status ??
        payloadOrIsPro.subscriptionStatus ??
        payloadOrIsPro.status ??
        ""
    ).toLowerCase();
    const isRevokedStatus =
      statusStr === "cancelled" ||
      statusStr === "canceled" ||
      statusStr === "expired" ||
      statusStr === "inactive" ||
      (payloadOrIsPro.purchaseState !== undefined &&
        !isPurchaseStatePurchased(payloadOrIsPro.purchaseState));

    const isActive =
      !isRevokedStatus &&
      Boolean(
        payloadOrIsPro.isSubscribed ??
          payloadOrIsPro.isPro ??
          payloadOrIsPro.isPremium ??
          payloadOrIsPro.premium_unlimited
      );

    if (isActive) {
      const productId = payloadOrIsPro.productId || payloadOrIsPro.tier || "premium_monthly";
      const record = persistGrantedSubscription(
        productId,
        payloadOrIsPro.purchaseToken,
        payloadOrIsPro.expiresAt
      );
      if (payloadOrIsPro.purchaseToken && payloadOrIsPro.isAcknowledged === false) {
        void acknowledgePlayPurchase(payloadOrIsPro.purchaseToken, productId);
      }
      notifySubscriptionUpdated(true, record);
    } else {
      resetPlaySubscription(true, statusStr === "expired" ? "expired" : "cancelled");
    }
  };

  window.onPurchasesUpdated = async (
    purchases: PlayPurchase | PlayPurchase[] | null | undefined
  ): Promise<void> => {
    const list = !purchases ? [] : Array.isArray(purchases) ? purchases : [purchases];
    let grantedAny = false;
    for (const p of list) {
      if (p && isPurchaseStatePurchased(p.purchaseState) && p.purchaseToken) {
        const ok = await processVerifiedPlayPurchase(p);
        if (ok) grantedAny = true;
      }
    }
    if (!grantedAny) {
      resetPlaySubscription(true, "cancelled");
    }
  };

  window.queryProductDetailsAsync = queryProductDetailsAsync;
  window.updateProductDetails = (details: unknown) => {
    parseAndApplyProductDetails(details);
  };
  window.setProductDetails = window.updateProductDetails;
}

registerWindowBillingBridge();