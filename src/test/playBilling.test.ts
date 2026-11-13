import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import {
  SUBSCRIPTIONS,
  isPlayBillingAvailable,
  buySubscription,
  hasActivePlaySubscription,
  resetPlaySubscription,
  WEEKLY_PRODUCT,
} from "@/lib/playBilling";
import {
  isWithinTrialPeriod,
  isAppPermanentlyBlocked,
} from "@/lib/trialManager";

describe("Google Play Digital Goods API & Reoccurring Subscription integration", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    document.cookie = "nume_first_open_timestamp=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    delete (window as unknown as Record<string, unknown>).getDigitalGoodsService;
    delete (window as unknown as Record<string, unknown>).PaymentRequest;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("defines the expected weekly subscription product ID, price, and attributes", () => {
    expect(WEEKLY_PRODUCT).toEqual({
      id: "premium_weekly",
      productId: "premium_weekly",
      basePlanId: "weekly-autorenewal",
      price: "$3.00",
      cadence: "Weekly Reoccurring Subscription",
    });
    expect(SUBSCRIPTIONS[0]).toEqual(WEEKLY_PRODUCT);
  });

  it("checks availability safely in non-play environments", () => {
    expect(isPlayBillingAvailable()).toBe(false);
  });

  it("rejects buySubscription when Google Play Billing API is not available", async () => {
    await expect(buySubscription("nume_pro_weekly", "weekly")).rejects.toThrow(
      "Google Play Billing reoccurring subscriptions are available only when opened from your installed Android app"
    );
    expect(localStorage.getItem("billing_status")).toBeNull();
    const active = await hasActivePlaySubscription();
    expect(active).toBe(false);
  });

  it("grants PRO access when Google Play PaymentRequest callback returns valid purchaseToken for weekly subscription", async () => {
    const mockComplete = vi.fn().mockResolvedValue(undefined);
    const mockShow = vi.fn().mockResolvedValue({
      details: { purchaseToken: "TEST_SUB_TOKEN_999" },
      complete: mockComplete,
    });

    (window as unknown as Record<string, unknown>).getDigitalGoodsService = vi.fn().mockResolvedValue({
      getDetails: vi.fn().mockResolvedValue([{ itemId: "nume_pro_weekly", price: { value: "2.99" } }]),
      listPurchases: vi.fn().mockResolvedValue([{ itemId: "nume_pro_weekly", purchaseToken: "TEST_SUB_TOKEN_999" }]),
    });

    (window as unknown as Record<string, unknown>).PaymentRequest = vi.fn().mockImplementation(() => ({
      show: mockShow,
      canMakePayment: vi.fn().mockResolvedValue(true),
    }));

    expect(isPlayBillingAvailable()).toBe(true);

    const res = await buySubscription("nume_pro_weekly", "weekly");
    expect(res.success).toBe(true);
    expect(res.purchaseToken).toBe("TEST_SUB_TOKEN_999");
    expect(mockComplete).toHaveBeenCalledWith("success");
    expect(localStorage.getItem("play_subscription_token")).toBe("TEST_SUB_TOKEN_999");

    const isActive = await hasActivePlaySubscription();
    expect(isActive).toBe(true);
  });

  it("clears Play subscription status and verified tokens on resetPlaySubscription", async () => {
    localStorage.setItem("play_subscription_token", "TEST_TOKEN");
    localStorage.setItem("billing_status", "active");
    localStorage.setItem("billing_plan_id", "nume_pro_weekly");

    resetPlaySubscription();

    expect(localStorage.getItem("play_subscription_token")).toBeNull();
    expect(localStorage.getItem("billing_status")).toBeNull();
    expect(localStorage.getItem("billing_plan_id")).toBeNull();
  });

  it("allows free trial uses and blocks when feature trials are exhausted", () => {
    localStorage.setItem("nume.feature_trials.graph", "3");
    localStorage.setItem("nume.feature_trials.equation", "3");
    localStorage.setItem("nume.feature_trials.converter", "4");

    expect(isWithinTrialPeriod()).toBe(false);
    expect(isAppPermanentlyBlocked(false)).toBe(true);
    // Subscribed users are never blocked even after trials are used up
    expect(isAppPermanentlyBlocked(true)).toBe(false);
  });
});
