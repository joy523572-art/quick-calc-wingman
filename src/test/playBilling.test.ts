import { describe, expect, it, beforeEach } from "vitest";
import {
  PRODUCT_ID_MONTHLY,
  PRODUCT_ID_WEEKLY,
  GOOGLE_PLAY_PRODUCTS,
  requestPlayBillingPurchase,
  restorePlayBillingPurchases,
} from "../lib/playBilling";

// Setup global localStorage mock for test environment
const storageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

if (typeof globalThis.localStorage === "undefined") {
  Object.defineProperty(globalThis, "localStorage", {
    value: storageMock,
    writable: true,
  });
}

describe("Play Billing Digital Goods API setup", () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
  });

  it("configures product IDs: premium_monthly and premium_weekly", () => {
    expect(PRODUCT_ID_MONTHLY).toBe("premium_monthly");
    expect(PRODUCT_ID_WEEKLY).toBe("premium_weekly");

    const productIds = GOOGLE_PLAY_PRODUCTS.map((p) => p.productId);
    expect(productIds).toContain("premium_monthly");
    expect(productIds).toContain("premium_weekly");
  });

  it("displays paywall price and billing period: $6/monthly and $3 weekly billed via Google play", () => {
    const monthly = GOOGLE_PLAY_PRODUCTS.find((p) => p.productId === "premium_monthly");
    const weekly = GOOGLE_PLAY_PRODUCTS.find((p) => p.productId === "premium_weekly");

    expect(monthly?.priceText).toBe("$6/monthly");
    expect(monthly?.billingPeriod).toBe("monthly");
    expect(monthly?.billingNote).toContain("$6/monthly, billed via Google play");

    expect(weekly?.priceText).toBe("$3 weekly");
    expect(weekly?.billingPeriod).toBe("weekly");
    expect(weekly?.billingNote).toContain("$3 weekly, billed via Google play");
  });

  it("simulates successful purchase and marks pro status in localStorage", async () => {
    expect(globalThis.localStorage.getItem("nume.pro.purchased")).toBeNull();

    const result = await requestPlayBillingPurchase("premium_monthly");
    expect(result.success).toBe(true);
    expect(globalThis.localStorage.getItem("nume.pro.purchased")).toBe("true");
    expect(globalThis.localStorage.getItem("nume.pro.subscription_id")).toBe("premium_monthly");
  });

  it("restores active purchases successfully", async () => {
    globalThis.localStorage.setItem("nume.pro.purchased", "true");
    const restored = await restorePlayBillingPurchases();
    expect(restored).toBe(true);
  });
});
