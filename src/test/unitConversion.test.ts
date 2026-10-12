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

  it("handles offline currency conversion using fallback table", () => {
    const converted = convertMeasurement(10, "currency", "USD", "EUR");
    expect(converted).toBeGreaterThan(5);
    expect(converted).toBeLessThan(15);
  });
});