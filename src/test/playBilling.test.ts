import { beforeEach, describe, expect, it } from "vitest";
import {
  SUBSCRIPTIONS,
  isPlayBillingAvailable,
  buySubscription,
  hasActivePlaySubscription,
  cancelWebSubscription,
} from "@/lib/playBilling";

describe("Google Play Billing integration", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("defines the expected subscription SKUs, base plan IDs, and prices", () => {
    expect(SUBSCRIPTIONS).toHaveLength(2);
    expect(SUBSCRIPTIONS[0]).toEqual({
      id: "monthly",
      productId: "monthly",
      basePlanId: "monthly-autorenewal",
      price: "$6/month",
      cadence: "Monthly",
    });
    expect(SUBSCRIPTIONS[1]).toEqual({
      id: "weekly",
      productId: "weekly",
      basePlanId: "weekly-autorenewal",
      price: "$3 weekly",
      cadence: "Weekly",
    });
  });

  it("checks availability safely in node/non-play environments", () => {
    expect(isPlayBillingAvailable()).toBe(false);
  });

  it("saves billing_status = active and billing_plan_id on weekly subscription success", async () => {
    const res = await buySubscription("weekly", "weekly-autorenewal", "tester@example.com");
    expect(res.success).toBe(true);
    expect(localStorage.getItem("billing_status")).toBe("active");
    expect(localStorage.getItem("billing_plan_id")).toBe("weekly-autorenewal");

    const isActive = await hasActivePlaySubscription();
    expect(isActive).toBe(true);
  });

  it("saves billing_status = active and billing_plan_id on monthly subscription success", async () => {
    const res = await buySubscription("monthly", "monthly-autorenewal", "tester@example.com");
    expect(res.success).toBe(true);
    expect(localStorage.getItem("billing_status")).toBe("active");
    expect(localStorage.getItem("billing_plan_id")).toBe("monthly-autorenewal");

    const isActive = await hasActivePlaySubscription();
    expect(isActive).toBe(true);
  });

  it("saves billing_status = failed when purchase fails", async () => {
    await expect(buySubscription("weekly", "weekly-autorenewal", "")).rejects.toThrow();
    expect(localStorage.getItem("billing_status")).toBe("failed");
  });

  it("clears billing_status and billing_plan_id on cancel", async () => {
    await buySubscription("monthly", "monthly-autorenewal", "tester@example.com");
    expect(localStorage.getItem("billing_status")).toBe("active");
    cancelWebSubscription();
    expect(localStorage.getItem("billing_status")).toBeNull();
    expect(localStorage.getItem("billing_plan_id")).toBeNull();
  });
});
