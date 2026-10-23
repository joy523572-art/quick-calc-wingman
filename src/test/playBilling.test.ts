import { describe, expect, it } from "vitest";
import { SUBSCRIPTIONS, isPlayBillingAvailable } from "@/lib/playBilling";

describe("Google Play Billing integration", () => {
  it("defines the expected subscription SKUs and prices", () => {
    expect(SUBSCRIPTIONS).toHaveLength(2);
    expect(SUBSCRIPTIONS[0]).toEqual({
      id: "premium_monthly",
      price: "$6/month",
      cadence: "Monthly",
    });
    expect(SUBSCRIPTIONS[1]).toEqual({
      id: "premium_weekly",
      price: "$3 weekly",
      cadence: "Weekly",
    });
  });

  it("checks availability safely in node/non-play environments", () => {
    expect(isPlayBillingAvailable()).toBe(false);
  });
});
