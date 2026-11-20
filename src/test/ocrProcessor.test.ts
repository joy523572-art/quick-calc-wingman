import { describe, expect, it } from "vitest";
import {
  normalizeMathOcrText,
  extractBestMathEquation,
  isValidAlgebraicEquation,
  enhanceLowLightAndDeblur,
  brightenColorImageForNight,
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

  it("normalizes and extracts handwritten arithmetic and square-root expressions", () => {
    expect(normalizeMathOcrText("√144 + 8")).toBe("sqrt(144) + 8");
    expect(extractBestMathEquation("Notes\n25 × 4 + 1O")).toBe("25 * 4 + 10");
  });

  it("recovers crisp dark ink on bright white paper from an unevenly lit dark night buffer", () => {
    const width = 60;
    const height = 40;
    const data = new Uint8ClampedArray(width * height * 4);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        // Left side is deep shadow (28/255), right side is dim lamp light (110/255)
        const bg = x < width / 2 ? 28 : 110;
        // Horizontal blurred/faint handwriting stroke along y = 19..20
        const isStroke = (y === 19 || y === 20) && x >= 10 && x <= 50;
        const val = isStroke ? Math.round(bg * 0.42) : bg;
        const idx = (y * width + x) * 4;
        data[idx] = val;
        data[idx + 1] = val;
        data[idx + 2] = val;
        data[idx + 3] = 255;
      }
    }

    enhanceLowLightAndDeblur(data, width, height);

    const shadowPaperPixel = data[(5 * width + 15) * 4];
    const litPaperPixel = data[(5 * width + 45) * 4];
    const shadowInkPixel = data[(19 * width + 15) * 4];
    const litInkPixel = data[(19 * width + 45) * 4];

    expect(shadowPaperPixel).toBeGreaterThanOrEqual(240);
    expect(litPaperPixel).toBeGreaterThanOrEqual(240);
    expect(shadowInkPixel).toBeLessThan(120);
    expect(litInkPixel).toBeLessThan(120);
  });

  it("lifts exposure of very dark natural color night images without clipping paper", () => {
    const width = 20;
    const height = 20;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 24;
      data[i + 1] = 22;
      data[i + 2] = 20;
      data[i + 3] = 255;
    }

    brightenColorImageForNight(data, width, height);
    expect(data[0]).toBeGreaterThan(70);
  });
});
