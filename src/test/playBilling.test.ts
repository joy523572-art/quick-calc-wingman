import { beforeEach, describe, expect, it } from "vitest";
import {
  SUBSCRIPTIONS,
  isPlayBillingAvailable,
  buySubscription,
  hasActivePlaySubscription,
  cancelWebSubscription,
  LIFETIME_PRODUCT,
} from "@/lib/playBilling";
import {
  getFirstOpenTimestamp,
  saveFirstOpenTimestamp,
  isWithinTrialPeriod,
  isAppPermanentlyBlocked,
} from "@/lib/trialManager";

describe("Google Play Lifetime Product & 1-Day Trial integration", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    document.cookie = "nume_first_open_timestamp=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
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

  it("checks availability safely in node/non-play environments", () => {
    expect(isPlayBillingAvailable()).toBe(false);
  });

  it("saves billing_status = active and billing_plan_id = lifetime_premium on purchase success", async () => {
    const res = await buySubscription("lifetime_premium", "lifetime_premium", "tester@example.com");
    expect(res.success).toBe(true);
    expect(localStorage.getItem("billing_status")).toBe("active");
    expect(localStorage.getItem("billing_plan_id")).toBe("lifetime_premium");

    const isActive = await hasActivePlaySubscription();
    expect(isActive).toBe(true);
  });

  it("saves billing_status = failed when purchase fails without valid email in web preview mode", async () => {
    await expect(buySubscription("lifetime_premium", "lifetime_premium", "")).rejects.toThrow();
    expect(localStorage.getItem("billing_status")).toBe("failed");
  });

  it("clears billing_status and billing_plan_id on reset", async () => {
    await buySubscription("lifetime_premium", "lifetime_premium", "tester@example.com");
    expect(localStorage.getItem("billing_status")).toBe("active");
    cancelWebSubscription();
    expect(localStorage.getItem("billing_status")).toBeNull();
    expect(localStorage.getItem("billing_plan_id")).toBeNull();
  });

  it("allows free trial and blocks on the 3rd distinct day", () => {
    localStorage.setItem("activeDays", JSON.stringify(["Mon Jan 01 2024", "Tue Jan 02 2024", "Wed Jan 03 2024"]));

    expect(isWithinTrialPeriod()).toBe(false);
    expect(isAppPermanentlyBlocked(false)).toBe(true);
    // Purchased users are never blocked even after trial expires
    expect(isAppPermanentlyBlocked(true)).toBe(false);
  });
});
