import { describe, expect, it } from "vitest";
import { formatWithCommas } from "../lib/formatNumber";

describe("formatWithCommas utility", () => {
  it("formats integers with thousands commas", () => {
    expect(formatWithCommas("1000")).toBe("1,000");
    expect(formatWithCommas("1234567")).toBe("1,234,567");
    expect(formatWithCommas(1000000)).toBe("1,000,000");
  });

  it("formats decimal numbers correctly", () => {
    expect(formatWithCommas("1234.56")).toBe("1,234.56");
    expect(formatWithCommas("1000000.999")).toBe("1,000,000.999");
  });

  it("handles non-numeric strings and special states", () => {
    expect(formatWithCommas("Error")).toBe("Error");
    expect(formatWithCommas("Trial used")).toBe("Trial used");
    expect(formatWithCommas("🔒")).toBe("🔒");
    expect(formatWithCommas("x = 5")).toBe("x = 5");
  });
});
