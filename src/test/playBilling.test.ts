import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import {
  SUBSCRIPTIONS,
  isPlayBillingAvailable,
  buySubscription,
  hasActivePlaySubscription,
  resetPlaySubscription,
  LIFETIME_PRODUCT,
} from "@/lib/playBilling";
import {
  isWithinTrialPeriod,
  isAppPermanentlyBlocked,
} from "@/lib/trialManager";

describe("Google Play Digital Goods API & Lifetime Purchase integration", () => {
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

  it("defines the expected lifetime product ID, price, and attributes", () => {
    expect(LIFETIME_PRODUCT).toEqual({
      id: "lifetime_premium",
      productId: "lifetime_premium",
      basePlanId: "lifetime_premium",
      price: "$19.99",
      cadence: "One-Time Lifetime Purchase",
    });
    expect(SUBSCRIPTIONS[0]).toEqual(LIFETIME_PRODUCT);
  });

  it("checks availability safely in non-play environments", () => {
    expect(isPlayBillingAvailable()).toBe(false);
  });

  it("rejects buySubscription when Google Play Billing API is not available (no mock unlocks)", async () => {
    await expect(buySubscription("lifetime_premium")).rejects.toThrow(
      "Google Play Billing is available only when opened from your installed Android app"
    );
    expect(localStorage.getItem("billing_status")).toBeNull();
    const active = await hasActivePlaySubscription();
    expect(active).toBe(false);
  });

  it("grants PRO access when Google Play PaymentRequest callback returns valid purchaseToken for lifetime_premium", async () => {
    const mockComplete = vi.fn().mockResolvedValue(undefined);
    const mockShow = vi.fn().mockResolvedValue({
      details: { purchaseToken: "TEST_GP_TOKEN_12345" },
      complete: mockComplete,
    });

    (window as unknown as Record<string, unknown>).getDigitalGoodsService = vi.fn().mockResolvedValue({
      getDetails: vi.fn().mockResolvedValue([{ itemId: "lifetime_premium", price: { value: "19.99" } }]),
      listPurchases: vi.fn().mockResolvedValue([{ itemId: "lifetime_premium", purchaseToken: "TEST_GP_TOKEN_12345" }]),
    });

    (window as unknown as Record<string, unknown>).PaymentRequest = vi.fn().mockImplementation(() => ({
      show: mockShow,
      canMakePayment: vi.fn().mockResolvedValue(true),
    }));

    expect(isPlayBillingAvailable()).toBe(true);

    const res = await buySubscription("lifetime_premium");
    expect(res.success).toBe(true);
    expect(res.purchaseToken).toBe("TEST_GP_TOKEN_12345");
    expect(mockComplete).toHaveBeenCalledWith("success");
    expect(localStorage.getItem("play_purchase_token")).toBe("TEST_GP_TOKEN_12345");

    const isActive = await hasActivePlaySubscription();
    expect(isActive).toBe(true);
  });

  it("clears Play billing status and verified tokens on resetPlaySubscription", async () => {
    localStorage.setItem("play_purchase_token", "TEST_TOKEN");
    localStorage.setItem("billing_status", "active");
    localStorage.setItem("billing_plan_id", "lifetime_premium");

    resetPlaySubscription();

    expect(localStorage.getItem("play_purchase_token")).toBeNull();
    expect(localStorage.getItem("billing_status")).toBeNull();
    expect(localStorage.getItem("billing_plan_id")).toBeNull();
  });

  it("allows free trial uses and blocks when feature trials are exhausted", () => {
    localStorage.setItem("nume.feature_trials.graph", "2");
    localStorage.setItem("nume.feature_trials.equation", "2");
    localStorage.setItem("nume.feature_trials.converter", "4");

    expect(isWithinTrialPeriod()).toBe(false);
    expect(isAppPermanentlyBlocked(false)).toBe(true);
    // Purchased users are never blocked even after trials are used up
    expect(isAppPermanentlyBlocked(true)).toBe(false);
  });
});

