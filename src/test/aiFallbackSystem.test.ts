import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  isLovableCloudCreditsAvailable,
  recordLovableCloudCreditDepletion,
  resetCircuitBreaker,
  getCurrentMonthKey,
  CIRCUIT_BREAKER_KEY,
  solveEquationWithAiFallback,
  convertWithAiFallback,
} from "@/lib/aiFallbackSystem";

describe("AI Fallback System & Circuit Breaker", () => {
  beforeEach(() => {
    localStorage.clear();
    resetCircuitBreaker();
    vi.restoreAllMocks();
  });

  it("reports Lovable Cloud credits available by default", () => {
    expect(isLovableCloudCreditsAvailable()).toBe(true);
  });

  it("trips circuit breaker when credits run out and stores current month in localStorage", () => {
    recordLovableCloudCreditDepletion();
    expect(isLovableCloudCreditsAvailable()).toBe(false);

    const stored = localStorage.getItem(CIRCUIT_BREAKER_KEY);
    expect(stored).toBeTruthy();
    expect(stored).toContain(getCurrentMonthKey());
  });

  it("automatically resets circuit breaker when a new month starts", () => {
    // Simulate depletion in a previous month (e.g. 2026-01)
    localStorage.setItem(
      CIRCUIT_BREAKER_KEY,
      JSON.stringify({
        depleted: true,
        month: "2025-12",
        depletedAt: 1735689600000,
        status: 402,
      })
    );

    // Current month is different, so it should auto-reset!
    const available = isLovableCloudCreditsAvailable();
    expect(available).toBe(true);
    expect(localStorage.getItem(CIRCUIT_BREAKER_KEY)).toBeNull();
  });

  it("solves equations silently with zero error even if cloud calls fail", async () => {
    // Simulate Lovable Cloud 402 depletion
    recordLovableCloudCreditDepletion();

    const res = await solveEquationWithAiFallback("2x + 5 = 15");
    expect(res).toBeDefined();
    expect(res.roots).toEqual([5]);
    expect(res.summary).toContain("5");
    expect(res.steps.length).toBeGreaterThan(0);
    expect([
      "Lovable Cloud",
      "Pollinations AI (Keyless)",
      "Kilo AI Gateway",
      "OVHcloud AI",
      "Wikipedia API",
      "Local Deterministic Engine",
    ]).toContain(res.providerUsed);
  });

  it("handles quadratic equations silently with zero error", async () => {
    const res = await solveEquationWithAiFallback("x² - 5x + 6 = 0");
    expect(res).toBeDefined();
    expect(res.roots).toEqual([3, 2]);
    expect(res.steps.length).toBeGreaterThan(0);
  });

  it("converts units silently with zero error across all fallbacks", async () => {
    const res = await convertWithAiFallback(100, "weight", "kg", "lb");
    expect(res).toBeDefined();
    expect(res.numericResult).toBeCloseTo(220.462, 1);
    expect(res.formattedResult).toBeDefined();
    expect([
      "Lovable Cloud",
      "Pollinations AI (Keyless)",
      "Kilo AI Gateway",
      "OVHcloud AI",
      "Wikipedia API",
      "Local Deterministic Engine",
    ]).toContain(res.providerUsed);
  });

  it("currency conversion succeeds silently with zero error", async () => {
    const res = await convertWithAiFallback(100, "currency", "USD", "EUR", 0.92);
    expect(res.numericResult).toBe(92);
    expect(res.formattedResult).toBe("92");
  });
});
