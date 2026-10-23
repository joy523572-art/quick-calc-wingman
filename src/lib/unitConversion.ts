import { CURRENCY_CODES, currencyName } from "./currencies";

export const UNIT_OPTIONS = {
  length: { m: "Meters", km: "Kilometers", cm: "Centimeters", mm: "Millimeters", mi: "Miles", ft: "Feet", in: "Inches", yd: "Yards" },
  weight: { kg: "Kilograms", g: "Grams", mg: "Milligrams", lb: "Pounds", oz: "Ounces" },
  temperature: { C: "Celsius", F: "Fahrenheit", K: "Kelvin" },
} as const;

export const CURRENCY_OPTIONS: Record<string, string> = Object.fromEntries(
  CURRENCY_CODES.map((c) => [c, `${c} · ${currencyName(c)}`]),
);

export type UnitCategory = keyof typeof UNIT_OPTIONS | "currency";

const LENGTH_IN_METERS: Record<string, number> = {
  m: 1, km: 1000, cm: 0.01, mm: 0.001, mi: 1609.344, ft: 0.3048, in: 0.0254, yd: 0.9144,
};
const WEIGHT_IN_KILOGRAMS: Record<string, number> = {
  kg: 1, g: 0.001, mg: 0.000001, lb: 0.45359237, oz: 0.028349523125,
};

export function convertMeasurement(value: number, category: UnitCategory, from: string, to: string, currencyRate?: number) {
  if (!Number.isFinite(value)) throw new Error("Enter a valid number.");
  if (category === "length") return value * LENGTH_IN_METERS[from] / LENGTH_IN_METERS[to];
  if (category === "weight") return value * WEIGHT_IN_KILOGRAMS[from] / WEIGHT_IN_KILOGRAMS[to];
  if (category === "currency") {
    if (from === to) return value;
    if (!currencyRate || !Number.isFinite(currencyRate) || currencyRate <= 0) throw new Error("A current exchange rate is not available yet.");
    return value * currencyRate;
  }
  if (from === to) return value;
  const celsius = from === "C" ? value : from === "F" ? (value - 32) * 5 / 9 : value - 273.15;
  return to === "C" ? celsius : to === "F" ? celsius * 9 / 5 + 32 : celsius + 273.15;
}

