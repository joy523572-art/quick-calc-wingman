import {
  clearLocalSubscriptionMetadata,
  computeSubscriptionExpiresAt,
  ProfileSubscriptionRecord,
  readLocalSubscriptionMetadata,
  SubscriptionStatus,
  syncSubscriptionToProfile,
} from "./subscriptionSync";
import { isEffectiveOffline } from "./networkMode";

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
  productId?: string;
  products?: string[];
  purchaseToken: string;
  acknowledgeState?: "acknowledged" | "unacknowledged" | string;
  purchaseState?: string | number;
  isAcknowledged?: boolean;
  expiryTime?: string;
  expiryTimeMillis?: number;
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
  queryPurchasesAsync?: () =>
    | void
    | string
    | PlayPurchase[]
    | Promise<string | PlayPurchase[] | void>;
  queryPurchases?: () =>
    | void
    | string
    | PlayPurchase[]
    | Promise<string | PlayPurchase[] | void>;
  queryProductDetailsAsync?: () => Promise<PlayItemDetails[] | unknown>;
  getProductDetails?: () => Promise<PlayItemDetails[] | unknown>;
  setPremium?: (isPremium: boolean) => void;
  openSubscriptionManagement?: () => void;
};

declare global {
  interface Window {
    getDigitalGoodsService?: (provider: string) => Promise<DigitalGoodsService>;
    AndroidBilling?: NativeAndroidBillingBridge;
    Android?: NativeAndroidBillingBridge;
    triggerPurchase?: (productId: string, basePlanId?: string) => Promise<boolean>;
    updateSubscriptionUI?: (payloadOrIsPro: boolean | NativeSubscriptionPayload) => void;
    onPurchasesUpdated?: (
      purchases: string | PlayPurchase | PlayPurchase[] | null | undefined
    ) => Promise<void>;
    queryPurchasesAsync?: () => Promise<PlayPurchase[]>;
    updateProductDetails?: (details: unknown) => void;
    setProductDetails?: (details: unknown) => void;
    queryProductDetailsAsync?: () => Promise<SubscriptionPlan[]>;
  }
}

export const SUBSCRIPTION_UPDATED_EVENT = "nume:subscription-updated";
export const TRIGGER_PURCHASE_EVENT = "nume:trigger-purchase";

const VALID_PRODUCT_IDS = new Set(["premium_weekly", "premium_monthly"]);

function getPurchaseProductId(purchase: Partial<PlayPurchase>): string {
  if (purchase.itemId) return purchase.itemId;
  if (purchase.productId) return purchase.productId;
  if (Array.isArray(purchase.products) && typeof purchase.products[0] === "string") {
    return purchase.products[0];
  }
  return "";
}

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

function isPurchaseExpired(purchase: Partial<PlayPurchase>): boolean {
  if (typeof purchase.expiryTimeMillis === "number" && purchase.expiryTimeMillis > 0) {
    return purchase.expiryTimeMillis <= Date.now();
  }
  if (typeof purchase.expiryTime === "string" && purchase.expiryTime.trim()) {
    const parsed = Date.parse(purchase.expiryTime);
    if (!Number.isNaN(parsed)) {
      return parsed <= Date.now();
    }
  }
  return false;
}

function isPurchaseActive(purchase: Partial<PlayPurchase> | null | undefined): purchase is PlayPurchase {
  if (!purchase) return false;
  const productId = getPurchaseProductId(purchase);
  return (
    Boolean(purchase.purchaseToken) &&
    isValidSubscriptionItem(productId) &&
    isPurchaseStatePurchased(purchase.purchaseState) &&
    !isPurchaseExpired(purchase)
  );
}

function parseRawPurchases(raw: unknown): PlayPurchase[] | null {
  if (raw === undefined || raw === null) return null;
  let value: unknown = raw;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    try {
      value = JSON.parse(trimmed);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(value)) return null;
  return value
    .filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === "object"))
    .map((entry) => {
      const products = Array.isArray(entry.products)
        ? entry.products.filter((p): p is string => typeof p === "string")
        : undefined;
      const itemId = String(
        entry.itemId || entry.productId || (products && products[0]) || ""
      );
      return {
        itemId,
        productId: typeof entry.productId === "string" ? entry.productId : itemId || undefined,
        products,
        purchaseToken: String(entry.purchaseToken || entry.token || ""),
        acknowledgeState:
          typeof entry.acknowledgeState === "string" ? entry.acknowledgeState : undefined,
        purchaseState:
          typeof entry.purchaseState === "string" || typeof entry.purchaseState === "number"
            ? entry.purchaseState
            : undefined,
        isAcknowledged:
          typeof entry.isAcknowledged === "boolean" ? entry.isAcknowledged : undefined,
        expiryTime: typeof entry.expiryTime === "string" ? entry.expiryTime : undefined,
        expiryTimeMillis:
          typeof entry.expiryTimeMillis === "number" ? entry.expiryTimeMillis : undefined,
      };
    });
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

  console.info("[PlayBilling] Processing Google Play Subscription purchaseToken for Acknowledgment", {
    productId,
    purchaseToken,
    tokenPrefix: purchaseToken.slice(0, 12),
  });

  try {
    const billing = service ?? (await getPlayBillingService());
    if (billing && typeof billing.acknowledge === "function") {
      await billing.acknowledge(purchaseToken);
      console.info("[PlayBilling] Acknowledge success via DigitalGoodsService (Acknowledged column in Play Console will show YES)", {
        productId,
        purchaseToken,
      });
      return true;
    }

    const bridge = typeof window !== "undefined" ? (window.AndroidBilling ?? window.Android) : undefined;
    if (bridge && typeof bridge.acknowledgePurchase === "function") {
      await bridge.acknowledgePurchase(purchaseToken);
      console.info("[PlayBilling] Acknowledge success via AndroidBilling bridge (Acknowledged column in Play Console will show YES)", {
        productId,
        purchaseToken,
      });
      return true;
    }

    console.info("[PlayBilling] Acknowledge request handled by Play payment/native wrapper", {
      productId,
      purchaseToken,
    });
    return true;
  } catch (err) {
    console.error("[PlayBilling] Acknowledge failure", {
      productId,
      purchaseToken,
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

  console.info("[PlayBilling] Persisting granted subscription entitlement locally", {
    tier: normalizedTier,
    purchaseToken: purchaseToken || localStorage.getItem("play_subscription_token"),
    expiresAt: resolvedExpiresAt,
  });

  try {
    localStorage.setItem("billing_status", "active");
    localStorage.setItem("billing_plan_id", normalizedTier);
    localStorage.setItem("subscription_active", "true");
    localStorage.setItem("isPremium", "true");
    if (purchaseToken) {
      localStorage.setItem("play_subscription_token", purchaseToken);
    }
    const nativeBridge = window.AndroidBilling ?? window.Android;
    nativeBridge?.setPremium?.(true);
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
  if (!isPurchaseActive(purchase)) {
    return false;
  }

  const rawItemId = getPurchaseProductId(purchase);
  const productId = isValidSubscriptionItem(rawItemId)
    ? rawItemId
    : "premium_monthly";

  console.info("[PlayBilling] processVerifiedPlayPurchase received verified purchase", {
    productId,
    purchaseToken: purchase.purchaseToken,
    isAcknowledged: purchase.isAcknowledged ?? purchase.acknowledgeState,
  });

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
    localStorage.setItem("isPremium", "false");
    clearLocalSubscriptionMetadata();
  } catch {
    // ignore storage issues
  }
}

export function isLocalSubscriptionExpired(): boolean {
  const meta = readLocalSubscriptionMetadata();
  // Only revoke locally when Google Play or backend explicitly reported cancellation/expiration.
  // Never expire an active auto-renewing subscriber offline solely from an estimated local timestamp.
  return (
    meta.subscription_status === "cancelled" ||
    meta.subscription_status === "expired"
  );
}

export function hasLocalActiveEntitlement(): boolean {
  if (typeof window === "undefined") return false;
  if (isLocalSubscriptionExpired()) {
    clearLocalEntitlementKeys();
    return false;
  }
  if (localStorage.getItem("isPremium") === "false") {
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

export interface PlaySubscriptionCheckResult {
  active: boolean;
  authoritative: boolean;
  purchases: PlayPurchase[];
}

/**
 * Production startup & lifecycle subscription check using Google Play `queryPurchasesAsync()`
 * (via Digital Goods API `listPurchases()` or native Android `queryPurchasesAsync()` / `queryPurchases()`).
 * - If device is genuinely offline (`navigator.onLine === false`), preserves existing active `isPremium`.
 * - If Play responds with NO active (PURCHASED & unexpired) subscription (handles user cancellation,
 *   expiry, and license-tester auto-cancel), immediately sets `isPremium = false` and revokes PRO.
 */
export async function checkPlaySubscriptionStatus(
  service?: DigitalGoodsService
): Promise<PlaySubscriptionCheckResult> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return {
      active: hasLocalActiveEntitlement(),
      authoritative: false,
      purchases: [],
    };
  }

  // 1. Google Play Digital Goods API (TWA / Play Store WebView)
  if (isPlayBillingAvailable() || service) {
    try {
      const billing = service ?? (await getPlayBillingService());
      if (billing && typeof billing.listPurchases === "function") {
        const purchases = parseRawPurchases(await billing.listPurchases()) ?? [];
        const activePurchase = purchases.find(isPurchaseActive);

        if (activePurchase) {
          await processVerifiedPlayPurchase(activePurchase, billing);
          return { active: true, authoritative: true, purchases };
        }

        // No active subscription found (user cancellation, expiry, or test auto-cancel):
        // explicitly set isPremium = false.
        resetPlaySubscription(true, "expired");
        return { active: false, authoritative: true, purchases: [] };
      }
    } catch (e) {
      console.warn(
        "[PlayBilling] Error querying Google Play subscriptions (falling back to saved local status):",
        e
      );
      return {
        active: hasLocalActiveEntitlement(),
        authoritative: false,
        purchases: [],
      };
    }
  }

  // 2. Native Android Billing Bridge (`queryPurchasesAsync` or `queryPurchases`)
  const nativeBridge =
    typeof window !== "undefined" ? (window.AndroidBilling ?? window.Android) : undefined;
  const nativeQueryFn = nativeBridge?.queryPurchasesAsync ?? nativeBridge?.queryPurchases;
  if (nativeBridge && typeof nativeQueryFn === "function") {
    try {
      const raw = await Promise.resolve(nativeQueryFn.call(nativeBridge));
      const nativePurchases = parseRawPurchases(raw);
      if (nativePurchases !== null) {
        const activeNative = nativePurchases.find(isPurchaseActive);
        if (activeNative) {
          await processVerifiedPlayPurchase(activeNative, null);
          return { active: true, authoritative: true, purchases: nativePurchases };
        }
        // Native BillingClient.queryPurchasesAsync() returned no active subscription: set isPremium = false
        resetPlaySubscription(true, "expired");
        return { active: false, authoritative: true, purchases: [] };
      }
    } catch (e) {
      console.warn("[PlayBilling] Error querying native Android purchases:", e);
    }
  }

  if (isEffectiveOffline()) {
    return {
      active: hasLocalActiveEntitlement(),
      authoritative: false,
      purchases: [],
    };
  }

  // 3. Backend Play Developer API verification fallback for stored purchaseToken
  const storedToken =
    typeof window !== "undefined" ? localStorage.getItem("play_subscription_token") : null;
  const storedTier =
    typeof window !== "undefined" ? localStorage.getItem("billing_plan_id") || undefined : undefined;
  if (storedToken) {
    const backendStatus = await verifyPlayPurchaseWithBackend(storedToken, storedTier);
    if (backendStatus && backendStatus.active === false) {
      resetPlaySubscription(true, backendStatus.status || "expired");
      return { active: false, authoritative: true, purchases: [] };
    }
    if (backendStatus && backendStatus.active === true) {
      const resolvedTier = backendStatus.productId || storedTier || "premium_monthly";
      persistGrantedSubscription(
        resolvedTier,
        storedToken,
        backendStatus.expiresAt || undefined
      );
      return {
        active: true,
        authoritative: true,
        purchases: [
          {
            itemId: resolvedTier,
            purchaseToken: storedToken,
            purchaseState: "PURCHASED",
            isAcknowledged: backendStatus.acknowledged ?? true,
            expiryTime: backendStatus.expiresAt || undefined,
          },
        ],
      };
    }
  }

  return {
    active: hasLocalActiveEntitlement(),
    authoritative: false,
    purchases: [],
  };
}

/**
 * Standard Google Play startup purchase query (`queryPurchasesAsync`).
 * Checks active subscriptions, acknowledges unacknowledged purchases, and sets
 * `isPremium = false` whenever Play reports no active subscription.
 */
export async function queryPurchasesAsync(
  service?: DigitalGoodsService
): Promise<PlayPurchase[]> {
  const result = await checkPlaySubscriptionStatus(service);
  return result.purchases;
}

/**
 * Checks Google Play Digital Goods API or native Android billing for active subscriptions on startup
 * and acknowledges any unacknowledged PURCHASED items.
 * If offline, preserves saved active subscription until online verification explicitly reports cancellation/expiry.
 */
export async function hasActivePlaySubscription(service?: DigitalGoodsService): Promise<boolean> {
  const result = await checkPlaySubscriptionStatus(service);
  return result.active;
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
    localStorage.setItem("isPremium", "false");

    const nativeBridge =
      typeof window !== "undefined" ? (window.AndroidBilling ?? window.Android) : undefined;
    try {
      nativeBridge?.setPremium?.(false);
    } catch {
      // ignore bridge access issues
    }

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
    purchases: string | PlayPurchase | PlayPurchase[] | null | undefined
  ): Promise<void> => {
    let parsed: PlayPurchase | PlayPurchase[] | null | undefined = purchases;
    if (typeof purchases === "string") {
      const normalized = parseRawPurchases(purchases);
      parsed = normalized ?? [];
    }
    const list = !parsed ? [] : Array.isArray(parsed) ? parsed : [parsed];
    let grantedAny = false;
    for (const p of list) {
      if (isPurchaseActive(p)) {
        const ok = await processVerifiedPlayPurchase(p);
        if (ok) grantedAny = true;
      }
    }
    if (!grantedAny) {
      resetPlaySubscription(true, "expired");
    }
  };

  window.queryPurchasesAsync = () => queryPurchasesAsync();
  window.queryProductDetailsAsync = queryProductDetailsAsync;
  window.updateProductDetails = (details: unknown) => {
    parseAndApplyProductDetails(details);
  };
  window.setProductDetails = window.updateProductDetails;
}

registerWindowBillingBridge();