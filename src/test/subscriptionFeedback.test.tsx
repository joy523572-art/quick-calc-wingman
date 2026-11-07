import { describe, expect, it } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { SubscriptionStatusFeedback } from "@/components/SubscriptionStatusFeedback";

describe("SubscriptionStatusFeedback Component", () => {
  it("renders nothing when status is null", () => {
    const { container } = render(
      <SubscriptionStatusFeedback
        status={null}
        onDismiss={() => {}}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders active success feedback when status is success", () => {
    let dismissed = false;
    render(
      <SubscriptionStatusFeedback
        status="success"
        planName="Monthly ($6/month)"
        onDismiss={() => {
          dismissed = true;
        }}
      />
    );

    expect(screen.getByText(/Subscription Active & Verified!/i)).toBeInTheDocument();
    expect(screen.getByText(/PRO UNLOCKED/i)).toBeInTheDocument();
    expect(screen.getByText(/Monthly \(\$6\/month\)/i)).toBeInTheDocument();

    const button = screen.getByRole("button", { name: /Start Using PRO Features/i });
    fireEvent.click(button);
    expect(dismissed).toBe(true);
  });

  it("renders friendly feedback with error message and retry button when status is failed", () => {
    let retried = false;
    render(
      <SubscriptionStatusFeedback
        status="failed"
        errorMessage="Google Play has not reported an active subscription yet."
        onDismiss={() => {}}
        onRetry={() => {
          retried = true;
        }}
      />
    );

    expect(screen.getByText(/Subscription Notice/i)).toBeInTheDocument();
    expect(screen.getByText(/Incomplete \/ Cancelled/i)).toBeInTheDocument();
    expect(screen.getByText(/Google Play has not reported an active subscription yet/i)).toBeInTheDocument();

    const retryBtn = screen.getByRole("button", { name: /Try Again/i });
    fireEvent.click(retryBtn);
    expect(retried).toBe(true);
  });
});
