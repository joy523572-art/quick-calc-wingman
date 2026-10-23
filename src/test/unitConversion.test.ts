import { describe, expect, it } from "vitest";
import { convertMeasurement } from "@/lib/unitConversion";

describe("unit conversions", () => {
  it("converts kilometers to meters", () => {
    expect(convertMeasurement(2, "length", "km", "m")).toBe(2000);
  });

  it("converts Celsius to Fahrenheit", () => {
    expect(convertMeasurement(0, "temperature", "C", "F")).toBe(32);
  });

  it("applies a supplied live currency exchange rate", () => {
    expect(convertMeasurement(10, "currency", "USD", "EUR", 0.9)).toBe(9);
  });

  it("covers worldwide currencies offline", async () => {
    const { CURRENCY_CODES, crossRate, readCachedRates } = await import("@/lib/currencies");
    expect(CURRENCY_CODES.length).toBeGreaterThan(150);
    expect(CURRENCY_CODES).toContain("NGN");
    expect(crossRate(readCachedRates(), "USD", "USD")).toBe(1);
  });
});
