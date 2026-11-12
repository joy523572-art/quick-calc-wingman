import { describe, expect, it } from "vitest";
import {
  normalizeMathOcrText,
  extractBestMathEquation,
  isValidAlgebraicEquation,
} from "@/lib/ocrImageProcessor";

describe("OCR Image Processor & Math Extractor", () => {
  it("normalizes handwritten math character misreads", () => {
    expect(normalizeMathOcrText("Sx + 1Ox = 5O")).toBe("5x + 10x = 50");
    expect(normalizeMathOcrText("2X + S = 1S")).toBe("2x + 5 = 15");
  });

  it("filters out noisy non-math line headers and extracts the best equation line", () => {
    const rawOcrText = `Ty vo RO EME en GE Ni TUS = CB Cpe Bi
5x + 10x = 50
Page 42`;

    const extracted = extractBestMathEquation(rawOcrText);
    expect(extracted).toBe("5x + 10x = 50");
  });

  it("extracts handwritten quadratic equation from noisy OCR", () => {
    const rawText = `Notebook Entry 01
x^2 - Sx + 6 = O`;

    const extracted = extractBestMathEquation(rawText);
    expect(extracted).toBe("x^2 - 5x + 6 = 0");
  });

  it("normalizes missing equals sign when followed by trailing value", () => {
    expect(normalizeMathOcrText("5x + 10x 50")).toBe("5x + 10x = 50");
  });

  it("strictly rejects non-math English word gibberish containing zero digits", () => {
    const gibberish = "Ty vo RO EME en GE Ni TUS = CB Cpe Bi";
    const extracted = extractBestMathEquation(gibberish);
    expect(extracted).toBe("");
  });

  it("strictly rejects broken fragments like '+ (0 =' from being considered valid equations", () => {
    expect(isValidAlgebraicEquation("+ (0 =")).toBe(false);
    expect(isValidAlgebraicEquation("+ (0 = 0")).toBe(false);
    expect(isValidAlgebraicEquation("(0 =")).toBe(false);
    expect(isValidAlgebraicEquation("Ty vo RO = CB")).toBe(false);
  });

  it("accurately identifies valid algebraic equations", () => {
    expect(isValidAlgebraicEquation("5x + 10x = 50")).toBe(true);
    expect(isValidAlgebraicEquation("2x + 5 = 15")).toBe(true);
    expect(isValidAlgebraicEquation("x^2 - 5x + 6 = 0")).toBe(true);
  });
});
