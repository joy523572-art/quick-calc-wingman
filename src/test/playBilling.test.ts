import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import {
  SUBSCRIPTIONS,
  SUBSCRIPTION_TAG,
  isPlayBillingAvailable,
  buySubscription,
  hasActivePlaySubscription,
  resetPlaySubscription,
  WEEKLY_PRODUCT,
  MONTHLY_PRODUCT,
  registerWindowBillingBridge,
  queryProductDetailsAsync,
  parseAndApplyProductDetails,
} from "@/lib/playBilling";
import {
  isWithinTrialPeriod,
  isAppPermanentlyBlocked,
  resetAllFeatureTrials,
} from "@/lib/trialManager";

describe("Google Play Digital Goods API, Subscriptions & Dynamic Pricing", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    resetAllFeatureTrials();
    delete (window as unknown as Record<string, unknown>).getDigitalGoodsService;
    delete (window as unknown as Record<string, unknown>).PaymentRequest;
    delete (window as unknown as Record<string, unknown>).AndroidBilling;
    registerWindowBillingBridge();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("defines exact product IDs, base plans, and Unlock All Features tag with default fallback formatted prices", () => {
    expect(SUBSCRIPTION_TAG).toBe("Unlock All Features");
    expect(MONTHLY_PRODUCT.id).toBe("premium_monthly");
    expect(MONTHLY_PRODUCT.productId).toBe("premium_monthly");
    expect(MONTHLY_PRODUCT.basePlanId).toBe("monthly-autorewal");
    expect(MONTHLY_PRODUCT.title).toBe("Monthly Subscription");
    expect(MONTHLY_PRODUCT.formattedPrice).toBe("$6.00");

    expect(WEEKLY_PRODUCT.id).toBe("premium_weekly");
    expect(WEEKLY_PRODUCT.productId).toBe("premium_weekly");
    expect(WEEKLY_PRODUCT.basePlanId).toBe("weekly-autorenewal");
    expect(WEEKLY_PRODUCT.title).toBe("Weekly Subscription");
    expect(WEEKLY_PRODUCT.formattedPrice).toBe("$3.00");
  });

  it("dynamically fetches and parses local formattedPrice for countries like Nigeria (₦500 / ₦1500) via queryProductDetailsAsync", async () => {
    // Mock Android Billing queryProductDetailsAsync with Nigerian Naira (₦1500 / ₦500)
    window.AndroidBilling = {
      queryProductDetailsAsync: vi.fn().mockResolvedValue([
        {
          productId: "premium_monthly",
          subscriptionOfferDetails: [
            {
              pricingPhases: {
                pricingPhaseList: [{ formattedPrice: "₦1,500", priceAmountMicros: 1500000000, priceCurrencyCode: "NGN" }],
              },
            },
          ],
        },
        {
          productId: "premium_weekly",
          subscriptionOfferDetails: [
            {
              pricingPhases: {
                pricingPhaseList: [{ formattedPrice: "₦500", priceAmountMicros: 500000000, priceCurrencyCode: "NGN" }],
              },
            },
          ],
        },
      ]),
    };

    const plans = await queryProductDetailsAsync();
    const monthly = plans.find((p) => p.productId === "premium_monthly");
    const weekly = plans.find((p) => p.productId === "premium_weekly");

    expect(monthly?.formattedPrice).toBe("₦1,500");
    expect(weekly?.formattedPrice).toBe("₦500");
    expect(monthly?.title).toBe("Monthly Subscription");
    expect(weekly?.title).toBe("Weekly Subscription");

    // Verifies cached so it works offline
    expect(localStorage.getItem("nume.product_details.v2")).toContain("₦1,500");
  });

  it("handles window.updateProductDetails called from native Android wrapper evaluateJavascript", () => {
    expect(typeof window.updateProductDetails).toBe("function");

    window.updateProductDetails?.([
      { productId: "premium_monthly", formattedPrice: "₦1,500" },
      { productId: "premium_weekly", formattedPrice: "₦500" },
    ]);

    const updated = parseAndApplyProductDetails(null);
    expect(updated.find((p) => p.productId === "premium_monthly")?.formattedPrice).toBe("₦1,500");
    expect(updated.find((p) => p.productId === "premium_weekly")?.formattedPrice).toBe("₦500");
  });

  it("checks availability safely in non-play environments", () => {
    expect(isPlayBillingAvailable()).toBe(false);
  });

  it("rejects buySubscription when Google Play Billing API is not available", async () => {
    await expect(buySubscription("premium_weekly", "weekly-autorenewal")).rejects.toThrow(
      "Google Play Billing reoccurring subscriptions are available only when opened from your installed Android app"
    );
    expect(localStorage.getItem("billing_status")).toBeNull();
    const active = await hasActivePlaySubscription();
    expect(active).toBe(false);
  });

  it("grants PRO access and acknowledges unacknowledged purchases on startup query", async () => {
    const mockAcknowledge = vi.fn().mockResolvedValue(undefined);
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    (window as unknown as Record<string, unknown>).getDigitalGoodsService = vi.fn().mockResolvedValue({
      getDetails: vi.fn().mockResolvedValue([{ itemId: "premium_monthly", price: { value: "6.00" } }]),
      listPurchases: vi.fn().mockResolvedValue([
        {
          itemId: "premium_monthly",
          purchaseToken: "TOKEN_UNACK_12345",
          acknowledgeState: "unacknowledged",
        },
      ]),
      acknowledge: mockAcknowledge,
    });

    (window as unknown as Record<string, unknown>).PaymentRequest = vi.fn();

    const isActive = await hasActivePlaySubscription();
    expect(isActive).toBe(true);
    expect(mockAcknowledge).toHaveBeenCalledWith("TOKEN_UNACK_12345");
    expect(localStorage.getItem("isPremium")).toBe("true");
    expect(infoSpy).toHaveBeenCalledWith(
      expect.stringContaining("[PlayBilling] Acknowledge success"),
      expect.objectContaining({ productId: "premium_monthly" })
    );
  });

  it("logs acknowledge failure cleanly when Digital Goods acknowledge throws", async () => {
    const mockAcknowledge = vi.fn().mockRejectedValue(new Error("Network timeout"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    (window as unknown as Record<string, unknown>).getDigitalGoodsService = vi.fn().mockResolvedValue({
      getDetails: vi.fn().mockResolvedValue([]),
      listPurchases: vi.fn().mockResolvedValue([
        {
          itemId: "premium_weekly",
          purchaseToken: "TOKEN_FAIL_999",
          acknowledgeState: "unacknowledged",
        },
      ]),
      acknowledge: mockAcknowledge,
    });
    (window as unknown as Record<string, unknown>).PaymentRequest = vi.fn();

    const isActive = await hasActivePlaySubscription();
    expect(isActive).toBe(true);
    expect(mockAcknowledge).toHaveBeenCalledWith("TOKEN_FAIL_999");
    expect(errorSpy).toHaveBeenCalledWith(
      "[PlayBilling] Acknowledge failure",
      expect.objectContaining({ productId: "premium_weekly", error: "Network timeout" })
    );
  });

  it("grants PRO access when Google Play PaymentRequest returns valid purchaseToken", async () => {
    const mockComplete = vi.fn().mockResolvedValue(undefined);
    const mockShow = vi.fn().mockResolvedValue({
      details: { purchaseToken: "TEST_SUB_TOKEN_999" },
      complete: mockComplete,
    });

    (window as unknown as Record<string, unknown>).getDigitalGoodsService = vi.fn().mockResolvedValue({
      getDetails: vi.fn().mockResolvedValue([{ itemId: "premium_weekly", price: { value: "3.00" } }]),
      listPurchases: vi.fn().mockResolvedValue([
        {
          itemId: "premium_weekly",
          purchaseToken: "TEST_SUB_TOKEN_999",
          acknowledgeState: "acknowledged",
        },
      ]),
    });

    (window as unknown as Record<string, unknown>).PaymentRequest = vi.fn().mockImplementation(() => ({
      show: mockShow,
      canMakePayment: vi.fn().mockResolvedValue(true),
    }));

    expect(isPlayBillingAvailable()).toBe(true);

    const res = await buySubscription("premium_weekly", "weekly-autorenewal");
    expect(res.success).toBe(true);
    expect(res.purchaseToken).toBe("TEST_SUB_TOKEN_999");
    expect(mockComplete).toHaveBeenCalledWith("success");
    expect(localStorage.getItem("play_subscription_token")).toBe("TEST_SUB_TOKEN_999");

    const isActive = await hasActivePlaySubscription();
    expect(isActive).toBe(true);
  });

  it("handles window.onPurchasesUpdated and window.triggerPurchase native wrapper bridge", async () => {
    const mockNativeAck = vi.fn().mockResolvedValue(true);
    const mockNativeTrigger = vi.fn().mockResolvedValue(true);
    window.AndroidBilling = {
      triggerPurchase: mockNativeTrigger,
      acknowledgePurchase: mockNativeAck,
    };

    const triggered = await window.triggerPurchase?.("premium_monthly", "monthly-autorewal");
    expect(triggered).toBe(true);
    expect(mockNativeTrigger).toHaveBeenCalledWith("premium_monthly", "monthly-autorewal");

    await window.onPurchasesUpdated?.([
      {
        itemId: "premium_monthly",
        purchaseToken: "NATIVE_TOKEN_ABC",
        purchaseState: "PURCHASED",
        isAcknowledged: false,
      },
    ]);

    expect(localStorage.getItem("isPremium")).toBe("true");
    expect(localStorage.getItem("billing_plan_id")).toBe("premium_monthly");
    expect(mockNativeAck).toHaveBeenCalledWith("NATIVE_TOKEN_ABC");
  });

  it("clears Play subscription status and verified tokens on resetPlaySubscription", () => {
    localStorage.setItem("play_subscription_token", "TEST_TOKEN");
    localStorage.setItem("billing_status", "active");
    localStorage.setItem("billing_plan_id", "premium_weekly");
    localStorage.setItem("isPremium", "true");

    resetPlaySubscription();

    expect(localStorage.getItem("play_subscription_token")).toBeNull();
    expect(localStorage.getItem("billing_status")).toBeNull();
    expect(localStorage.getItem("billing_plan_id")).toBeNull();
    expect(localStorage.getItem("isPremium")).toBeNull();
  });

  it("allows free trial uses and blocks when feature trials are exhausted", () => {
    localStorage.setItem("nume.feature_trials.graph", "3");
    localStorage.setItem("nume.feature_trials.equation", "3");
    localStorage.setItem("nume.feature_trials.converter", "4");

    expect(isWithinTrialPeriod()).toBe(false);
    expect(isAppPermanentlyBlocked(false)).toBe(true);
    expect(isAppPermanentlyBlocked(true)).toBe(false);
  });

  it("automatically revokes premium_unlimited and PRO when Google Play returns empty purchases after cancellation", async () => {
    localStorage.setItem("premium_unlimited", "true");
    localStorage.setItem("isPremium", "true");
    localStorage.setItem("subscription_active", "true");
    localStorage.setItem("billing_status", "active");
    localStorage.setItem("play_subscription_token", "CANCELLED_TOKEN");

    const onUpdated = vi.fn();
    window.addEventListener("nume:subscription-updated", onUpdated);

    (window as unknown as Record<string, unknown>).getDigitalGoodsService = vi.fn().mockResolvedValue({
      getDetails: vi.fn().mockResolvedValue([]),
      listPurchases: vi.fn().mockResolvedValue([]),
    });
    (window as unknown as Record<string, unknown>).PaymentRequest = vi.fn();

    const active = await hasActivePlaySubscription();
    expect(active).toBe(false);
    expect(localStorage.getItem("premium_unlimited")).toBeNull();
    expect(localStorage.getItem("isPremium")).toBeNull();
    expect(localStorage.getItem("subscription_active")).toBeNull();
    expect(localStorage.getItem("billing_status")).toBeNull();
    expect(localStorage.getItem("play_subscription_token")).toBeNull();
    expect(onUpdated).toHaveBeenCalled();
    window.removeEventListener("nume:subscription-updated", onUpdated);
  });

  it("automatically revokes premium_unlimited when native Android queryPurchases or onPurchasesUpdated returns empty", async () => {
    localStorage.setItem("premium_unlimited", "true");
    localStorage.setItem("isPremium", "true");

    window.AndroidBilling = {
      queryPurchases: vi.fn().mockResolvedValue([]),
    };

    const active = await hasActivePlaySubscription();
    expect(active).toBe(false);
    expect(localStorage.getItem("premium_unlimited")).toBeNull();
    expect(localStorage.getItem("isPremium")).toBeNull();

    localStorage.setItem("premium_unlimited", "true");
    localStorage.setItem("isPremium", "true");
    await window.onPurchasesUpdated?.([]);
    expect(localStorage.getItem("premium_unlimited")).toBeNull();
    expect(localStorage.getItem("isPremium")).toBeNull();
  });

  it("never drops premium for active subscribers while offline until explicitly cancelled", async () => {
    const { setNetworkPreference } = await import("@/lib/networkMode");
    const pastEstimatedRenewal = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    localStorage.setItem("isPremium", "true");
    localStorage.setItem(
      "nume.subscription_profile.v1",
      JSON.stringify({
        subscription_status: "active",
        subscription_tier: "premium_weekly",
        subscription_expires_at: pastEstimatedRenewal,
      })
    );

    // 1. Device goes offline: active subscriber MUST keep premium even if local renewal timestamp passed
    const onLineSpy = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    expect(await hasActivePlaySubscription()).toBe(true);
    expect(localStorage.getItem("isPremium")).toBe("true");
    onLineSpy.mockRestore();

    // 2. User switches in-app Offline toggle on: active subscriber MUST keep premium
    setNetworkPreference("offline");
    expect(await hasActivePlaySubscription()).toBe(true);
    expect(localStorage.getItem("isPremium")).toBe("true");
    setNetworkPreference("online");

    // 3. Only when subscription is actually cancelled is premium revoked
    localStorage.setItem(
      "nume.subscription_profile.v1",
      JSON.stringify({
        subscription_status: "cancelled",
        subscription_tier: null,
        subscription_expires_at: null,
      })
    );
    expect(await hasActivePlaySubscription()).toBe(false);
    expect(localStorage.getItem("isPremium")).toBeNull();
  });
});
