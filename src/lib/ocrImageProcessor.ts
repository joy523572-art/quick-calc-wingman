/**
 * High-performance OCR Image Preprocessor and Mathematical Equation Extractor.
 * Solves the taproot causes of camera upload delays, noise misreads, and number forgery.
 */
import type { Worker } from "tesseract.js";

/**
 * Night-vision & anti-blur handwriting enhancement pipeline ($O(W \times H)$):
 * 1. Adaptive gamma lift rescues faint ink & dark paper shot at night or under dim light.
 * 2. 3x3 unsharp-mask kernel sharpens defocused / motion-blurred strokes.
 * 3. Integral-image (summed-area table) local background normalization removes uneven shadows
 *    across the page so dark shadowed ink remains crisp without crushing corners to black.
 */
export function enhanceLowLightAndDeblur(
  data: Uint8ClampedArray,
  width: number,
  height: number
): void {
  const len = width * height;
  if (width <= 0 || height <= 0 || data.length < len * 4) return;

  const gray = new Uint8Array(len);
  let lumSum = 0;
  for (let i = 0, j = 0; j < len; i += 4, j++) {
    const g = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    gray[j] = g;
    lumSum += g;
  }

  const meanLum = lumSum / len;

  // Step 1: Adaptive night exposure boost when photo is dim or under-exposed
  const lifted = new Uint8Array(len);
  if (meanLum < 135) {
    const gamma = Math.max(0.34, Math.min(0.88, meanLum / 160));
    const gammaLut = new Uint8Array(256);
    for (let v = 0; v < 256; v++) {
      gammaLut[v] = Math.min(255, Math.round(Math.pow(v / 255, gamma) * 255));
    }
    for (let j = 0; j < len; j++) {
      lifted[j] = gammaLut[gray[j]];
    }
  } else {
    lifted.set(gray);
  }

  // Step 2: 3x3 Unsharp-Mask sharpening for blurry / out-of-focus writing
  const sharp = new Uint8Array(len);
  sharp.set(lifted);
  if (width >= 3 && height >= 3) {
    for (let y = 1; y < height - 1; y++) {
      const rowOffset = y * width;
      for (let x = 1; x < width - 1; x++) {
        const idx = rowOffset + x;
        const c = lifted[idx];
        const lap =
          4 * c -
          lifted[idx - 1] -
          lifted[idx + 1] -
          lifted[idx - width] -
          lifted[idx + width];
        const sharpened = c + Math.round(0.58 * lap);
        sharp[idx] = sharpened < 0 ? 0 : sharpened > 255 ? 255 : sharpened;
      }
    }
  }

  // Step 3: Build summed-area table (integral image) for fast local illumination estimation
  const stride = width + 1;
  const sat = new Float64Array(stride * (height + 1));
  for (let y = 1; y <= height; y++) {
    let rowSum = 0;
    const srcRow = (y - 1) * width;
    const dstRow = y * stride;
    const prevRow = (y - 1) * stride;
    for (let x = 1; x <= width; x++) {
      rowSum += sharp[srcRow + x - 1];
      sat[dstRow + x] = sat[prevRow + x] + rowSum;
    }
  }

  const radius = Math.max(8, Math.min(48, Math.round(Math.min(width, height) * 0.055)));

  // Step 4: Normalize each pixel relative to its local neighborhood brightness
  for (let y = 0; y < height; y++) {
    const y0 = Math.max(0, y - radius);
    const y1 = Math.min(height - 1, y + radius);
    const topOff = y0 * stride;
    const botOff = (y1 + 1) * stride;
    const rowLen = y1 - y0 + 1;

    for (let x = 0; x < width; x++) {
      const x0 = Math.max(0, x - radius);
      const x1 = Math.min(width - 1, x + radius);
      const boxSum =
        sat[botOff + x1 + 1] -
        sat[topOff + x1 + 1] -
        sat[botOff + x0] +
        sat[topOff + x0];
      const localMean = boxSum / (rowLen * (x1 - x0 + 1));

      const j = y * width + x;
      const px = sharp[j];
      const diff = localMean - px;
      const ratio = px / Math.max(12, localMean);

      let out: number;
      if (ratio >= 0.96 || diff < 3) {
        out = 255;
      } else {
        const scaled = Math.max(0, Math.min(1, (ratio - 0.66) / 0.3));
        out = Math.round(Math.pow(scaled, 1.35) * 235);
      }

      const rgba = j * 4;
      data[rgba] = out;
      data[rgba + 1] = out;
      data[rgba + 2] = out;
      data[rgba + 3] = 255;
    }
  }
}

/**
 * Gently lifts exposure and sharpens blur on the natural color view for dark scenes
 * while preserving original pencil/pen hue, paper lines, and shading cues for Vision AI.
 */
export function brightenColorImageForNight(
  data: Uint8ClampedArray,
  width: number,
  height: number
): void {
  const len = width * height;
  if (width <= 0 || height <= 0 || data.length < len * 4) return;

  let lumSum = 0;
  for (let i = 0, j = 0; j < len; i += 4, j++) {
    lumSum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  const meanLum = lumSum / len;

  if (meanLum < 125) {
    const gamma = Math.max(0.45, Math.min(0.88, meanLum / 145));
    const lut = new Uint8Array(256);
    for (let v = 0; v < 256; v++) {
      lut[v] = Math.min(255, Math.round(Math.pow(v / 255, gamma) * 255));
    }
    for (let i = 0; i < len * 4; i += 4) {
      data[i] = lut[data[i]];
      data[i + 1] = lut[data[i + 1]];
      data[i + 2] = lut[data[i + 2]];
    }
  }

  // Gentle 3x3 unsharp mask across color channels to counter camera motion blur
  if (width >= 3 && height >= 3) {
    const copy = new Uint8ClampedArray(data);
    const rowBytes = width * 4;
    for (let y = 1; y < height - 1; y++) {
      const rowOff = y * rowBytes;
      for (let x = 1; x < width - 1; x++) {
        const idx = rowOff + x * 4;
        for (let c = 0; c < 3; c++) {
          const center = copy[idx + c];
          const lap =
            4 * center -
            copy[idx - 4 + c] -
            copy[idx + 4 + c] -
            copy[idx - rowBytes + c] -
            copy[idx + rowBytes + c];
          const val = center + Math.round(0.32 * lap);
          data[idx + c] = val < 0 ? 0 : val > 255 ? 255 : val;
        }
      }
    }
  }
}

async function blobToBase64(blob: Blob): Promise<string> {
  if (typeof blob.arrayBuffer === "function") {
    const buf = await blob.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    if (typeof btoa === "function") {
      return btoa(binary);
    }
  }
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Unable to read photo."));
    reader.readAsDataURL(blob);
  });
  return dataUrl.replace(/^data:[^;]+;base64,/, "");
}

/**
 * Prepares dual base64 JPEG views (max 1440px) for multimodal AI vision:
 * - `base64`: exposure-lifted & softly sharpened natural view
 * - `enhancedBase64`: night-vision local contrast + deblurred view for dark/blurry writing
 */
export async function prepareImageForVision(
  file: Blob | File
): Promise<{ base64: string; enhancedBase64?: string; mimeType: string }> {
  try {
    if (typeof window !== "undefined" && "createImageBitmap" in window) {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      const maxDim = 1440;
      let width = bitmap.width;
      let height = bitmap.height;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(bitmap, 0, 0, width, height);
        bitmap.close?.();

        const rawImageData = ctx.getImageData(0, 0, width, height);
        const naturalData = new Uint8ClampedArray(rawImageData.data);
        brightenColorImageForNight(naturalData, width, height);
        rawImageData.data.set(naturalData);
        ctx.putImageData(rawImageData, 0, 0);

        const naturalBlob = await new Promise<Blob>((resolve) =>
          canvas.toBlob((b) => resolve(b || file), "image/jpeg", 0.9)
        );

        // Generate second night-vision & deblurred contrast view
        const nightData = new Uint8ClampedArray(naturalData);
        enhanceLowLightAndDeblur(nightData, width, height);
        rawImageData.data.set(nightData);
        ctx.putImageData(rawImageData, 0, 0);

        const nightBlob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob((b) => resolve(b), "image/jpeg", 0.88)
        );

        const [base64, enhancedBase64] = await Promise.all([
          blobToBase64(naturalBlob),
          nightBlob ? blobToBase64(nightBlob) : Promise.resolve(undefined),
        ]);

        return {
          base64,
          enhancedBase64,
          mimeType: naturalBlob.type || "image/jpeg",
        };
      }
      bitmap.close?.();
    }
  } catch {
    // Fall back to direct byte read
  }

  return {
    base64: await blobToBase64(file),
    mimeType: file.type || "image/jpeg",
  };
}

/**
 * Rescales raw multi-megapixel camera photos to max 1100px and applies night-vision
 * adaptive illumination + deblurring for accurate offline OCR processing.
 */
export async function preprocessImageForOcr(file: File): Promise<Blob> {
  try {
    if (typeof window !== "undefined" && "createImageBitmap" in window) {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      const maxDim = 1100;
      let width = bitmap.width;
      let height = bitmap.height;

      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(bitmap, 0, 0, width, height);
        bitmap.close?.();

        const imageData = ctx.getImageData(0, 0, width, height);
        enhanceLowLightAndDeblur(imageData.data, width, height);
        ctx.putImageData(imageData, 0, 0);

        return new Promise<Blob>((resolve) => {
          canvas.toBlob((blob) => resolve(blob || file), "image/jpeg", 0.92);
        });
      }
    }
  } catch {
    // Fall back to Image element
  }

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    let settled = false;
    const finish = (result: Blob) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      resolve(result);
    };
    const timer = setTimeout(() => finish(file), 3000);

    img.onload = () => {
      const maxDim = 1100;
      let width = img.width;
      let height = img.height;

      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        finish(file);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      const imageData = ctx.getImageData(0, 0, width, height);
      enhanceLowLightAndDeblur(imageData.data, width, height);
      ctx.putImageData(imageData, 0, 0);

      canvas.toBlob(
        (blob) => {
          finish(blob || file);
        },
        "image/jpeg",
        0.92
      );
    };

    img.onerror = () => {
      finish(file);
    };

    img.src = url;
  });
}

/**
 * Rotates an image Blob by a specified degree angle on Canvas to recover equations
 * taken when the phone was held in landscape or upside-down over a notebook.
 */
async function rotateImageBlobDeg(blob: Blob, degrees: number): Promise<Blob> {
  if (typeof window === "undefined") return blob;
  try {
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    if (degrees === 90 || degrees === 270) {
      canvas.width = bitmap.height;
      canvas.height = bitmap.width;
    } else {
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close?.();
      return blob;
    }

    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((degrees * Math.PI) / 180);
    ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
    bitmap.close?.();

    return new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => resolve(b || blob), "image/jpeg", 0.92);
    });
  } catch {
    return blob;
  }
}

// Global cached Tesseract worker configured strictly for mathematical characters
let cachedWorkerPromise: Promise<Worker> | null = null;

async function getMathTesseractWorker(): Promise<Worker> {
  if (!cachedWorkerPromise) {
    cachedWorkerPromise = (async () => {
      const { createWorker, PSM } = await import("tesseract.js");
      // Use local traineddata on the app's own origin to eliminate slow CDN downloads & spinning delays
      const langPath = typeof window !== "undefined" && window.location?.origin
        ? `${window.location.origin}/tessdata`
        : "/tessdata";

      const worker = await createWorker("eng", 1, {
        langPath,
        gzip: false,
        cacheMethod: "readOnly",
      });

      try {
        // Do NOT use tessedit_char_whitelist on Tesseract LSTM (v7), as whitelisting destroys
        // neural sequence decoding and garbles valid equations into stuttering tokens.
        await worker.setParameters({
          tessedit_pageseg_mode: PSM.AUTO,
        });
      } catch {
        // If setParameters fails in environment, continue gracefully
      }
      return worker;
    })();
  }
  return cachedWorkerPromise;
}

export interface OcrResult {
  text: string;
  confidence: number;
}

/**
 * Fast mathematical OCR reading using a cached worker and local traineddata.
 * Supports multi-angle orientation passes (0°, 90°, 270°, 180°) and returns confidence.
 */
export async function performFastMathOcr(imageBlob: Blob | File): Promise<OcrResult> {
  try {
    const worker = await getMathTesseractWorker();
    const ret = await worker.recognize(imageBlob);
    const text = ret?.data?.text || "";
    const confidence = (ret?.data?.confidence ?? 60) / 100;

    // If an equation with both an equals sign and numbers was detected on first pass, return immediately
    if (text.includes("=") && /\d/.test(text)) {
      return { text, confidence };
    }

    // Pass 2: Phone camera held landscape-right over desk (90° clockwise)
    const rotated90 = await rotateImageBlobDeg(imageBlob, 90);
    const ret2 = await worker.recognize(rotated90);
    const text2 = ret2?.data?.text || "";
    const conf2 = (ret2?.data?.confidence ?? 60) / 100;
    if (text2.includes("=") && /\d/.test(text2)) {
      return { text: text2, confidence: conf2 };
    }

    // Pass 3: Phone camera held landscape-left over desk (270° clockwise)
    const rotated270 = await rotateImageBlobDeg(imageBlob, 270);
    const ret3 = await worker.recognize(rotated270);
    const text3 = ret3?.data?.text || "";
    const conf3 = (ret3?.data?.confidence ?? 60) / 100;
    if (text3.includes("=") && /\d/.test(text3)) {
      return { text: text3, confidence: conf3 };
    }

    // Pass 4: Upside-down photo (180°)
    const rotated180 = await rotateImageBlobDeg(imageBlob, 180);
    const ret4 = await worker.recognize(rotated180);
    const text4 = ret4?.data?.text || "";
    const conf4 = (ret4?.data?.confidence ?? 60) / 100;
    if (text4.includes("=") && /\d/.test(text4)) {
      return { text: text4, confidence: conf4 };
    }

    return {
      text: text || text2 || text3 || text4,
      confidence: Math.max(confidence, conf2, conf3, conf4, 0.5),
    };
  } catch {
    // Graceful fallback to one-shot recognize if worker reuse encounters an error
    try {
      const { recognize } = await import("tesseract.js");
      const ret = await recognize(imageBlob, "eng");
      return { text: ret?.data?.text || "", confidence: (ret?.data?.confidence ?? 50) / 100 };
    } catch {
      return { text: "", confidence: 0 };
    }
  }
}

/**
 * Score a line of OCR text for mathematical relevance.
 * Heavily penalizes non-math English words and strictly requires digits.
 */
function calculateMathScore(line: string): number {
  let score = 0;

  // Digits count
  const digits = (line.match(/\d/g) || []).length;
  score += digits * 4;

  // Variables x, y
  const vars = (line.match(/[xyXY]/g) || []).length;
  score += vars * 4;

  // Equals sign
  if (line.includes("=") || line.includes("＝")) score += 10;

  // Operators +, -, *, /, ^
  const ops = (line.match(/[+\-*^²³/]/g) || []).length;
  score += ops * 3;

  // Heavily penalize long non-math English words (e.g. "Ty", "vo", "EME", "TUS")
  const nonMathTokens = line.split(/\s+/).filter((w) => /^[a-zA-Z]{2,}$/.test(w) && !/^[xyXY]$/i.test(w));
  score -= nonMathTokens.length * 6;

  // A valid mathematical equation strictly requires at least one digit
  if (digits === 0) {
    score -= 25;
  }

  return score;
}

/**
 * Normalizes handwritten math OCR character misreads without forging new numbers.
 */
export function normalizeMathOcrText(text: string): string {
  if (!text) return "";

  let cleaned = text
    .replace(/＝/g, "=")
    .replace(/[—–−]/g, "-")
    .replace(/[×·]/g, "*")
    .replace(/÷/g, "/")
    .replace(/√\s*\(([^)]+)\)/g, "sqrt($1)")
    .replace(/√\s*(\d+(?:\.\d+)?)/g, "sqrt($1)")
    .replace(/,/g, "")
    .replace(/\s+/g, " ");

  // Common handwritten misreads in math contexts:
  // 1) S/s before 'x', digits, operators -> '5' (e.g. 'Sx' -> '5x', '2x + S = 15' -> '2x + 5 = 15')
  cleaned = cleaned.replace(/\b[Ss](?=[xX\d])/g, "5");
  cleaned = cleaned.replace(/(?<=\d|\b|\s)[Ss](?=\b|\d|\s*[=+\-*^/])/g, "5");
  cleaned = cleaned.replace(/[Ss](?=\d)/g, "5");

  // 2) O/o after '=', operators, or next to digits -> '0' (e.g. '= O' -> '= 0', '1O' -> '10')
  cleaned = cleaned.replace(/(?<=(=|\b|\d))\s+[Oo]\b/g, " 0");
  cleaned = cleaned.replace(/(?<=\d)[Oo]/g, "0");
  cleaned = cleaned.replace(/[Oo](?=\d)/g, "0");
  cleaned = cleaned.replace(/=\s*[Oo]\b/g, "= 0");

  // 3) l/I inside digits or before 'x' -> '1'
  cleaned = cleaned.replace(/(?<=\d)[lI]/g, "1");
  cleaned = cleaned.replace(/[lI](?=\d)/g, "1");
  cleaned = cleaned.replace(/\b[lI](?=[xX])/g, "1");

  // 4) Z/z adjacent to digits -> '2'
  cleaned = cleaned.replace(/(?<=\d)[Zz]/g, "2");
  cleaned = cleaned.replace(/[Zz](?=\d)/g, "2");

  // 5) t/T standalone operator between variables/numbers -> '+'
  cleaned = cleaned.replace(/(?<=[a-zA-Z\d\s])\s+[tT]\s+(?=[a-zA-Z\d\s])/g, " + ");

  // 6) X/x after digits -> 'x' (variable), e.g. 5X -> 5x, 10X -> 10x
  cleaned = cleaned.replace(/(\d)\s*[X]/g, "$1x");

  // 7) Handle missing '+' between variable terms like "5x 10x = 50" -> "5x + 10x = 50"
  cleaned = cleaned.replace(/([a-zA-Z\d]+x)\s+([a-zA-Z\d]+x)/gi, "$1 + $2");

  // 8) If missing equals sign but has trailing number after variable (e.g. "5x + 10x 50"), insert "="
  if (!cleaned.includes("=") && /[a-zA-Z]\s+(\d+)$/.test(cleaned.trim())) {
    cleaned = cleaned.trim().replace(/([a-zA-Z])\s+(\d+)$/, "$1 = $2");
  }

  // 9) Remove isolated leading dangling operators like "+ (0 ="
  cleaned = cleaned.replace(/^[+*/^]+\s*(?=[a-zA-Z\d])/, "");

  return cleaned.trim();
}

/**
 * Validates whether a candidate string is a mathematically parseable algebraic equation.
 * Strictly prevents fragments like "+ (0 =" or unclosed parentheses from entering the solver.
 */
export function isValidAlgebraicEquation(equation: string): boolean {
  if (!equation || typeof equation !== "string") return false;
  const clean = equation.trim();
  if (clean.length < 3) return false;

  // Must contain an equals sign
  if (!clean.includes("=")) return false;

  const sides = clean.split("=");
  if (sides.length !== 2) return false;

  const left = sides[0].trim();
  const right = sides[1].trim();

  // Both sides must have non-empty content
  if (!left || !right) return false;

  // Left side cannot be just a stray operator like "+" or "("
  if (/^[+\-*/^()]+$/.test(left)) return false;

  // Must contain at least one digit
  if (!/\d/.test(clean)) return false;

  // Must contain a variable (x, y) to solve for
  if (!/[xyXY]/.test(clean)) return false;

  // Check balanced parentheses
  let parens = 0;
  for (const char of clean) {
    if (char === "(") parens++;
    if (char === ")") parens--;
    if (parens < 0) return false;
  }
  if (parens !== 0) return false;

  return true;
}

/**
 * Extracts the best mathematical equation candidate from raw OCR output.
 * Guaranteed: NEVER returns non-math gibberish or zero-digit text.
 */
export function extractBestMathEquation(rawOcr: string): string {
  if (!rawOcr || !rawOcr.trim()) return "";

  const lines = rawOcr
    .split(/\r?\n/)
    .map((l) => normalizeMathOcrText(l.trim()))
    .filter(Boolean);

  if (lines.length === 0) return "";

  // Rank lines by mathematical score
  const scoredLines = lines.map((line) => ({
    line,
    score: calculateMathScore(line),
  }));

  scoredLines.sort((a, b) => b.score - a.score);

  // Check if highest scored line is a valid algebraic equation
  for (const item of scoredLines) {
    if (isValidAlgebraicEquation(item.line)) {
      return item.line;
    }
  }

  const best = scoredLines[0];

  // If top line has positive math score AND contains digits, check if it can be an equation
  if (best && best.score > 2 && /\d/.test(best.line) && /[xyXY]/.test(best.line)) {
    return best.line;
  }

  // Fallback: look for any line that actually contains digits, variables, and operators
  for (const item of scoredLines) {
    if (/\d/.test(item.line) && /[xyXY]/.test(item.line) && (item.line.includes("=") || /[+\-*^/]/.test(item.line))) {
      const mathTokensOnly = item.line
        .split(/\s+/)
        .filter((w) => /^[\dxyXY+\-*^²³/=().]+$/.test(w))
        .join(" ");
      if (mathTokensOnly && /\d/.test(mathTokensOnly)) {
        return mathTokensOnly;
      }
    }
  }

  // Combined fallback: search for standard regex pattern with digits
  const fullCombined = lines.join(" ");
  const match = fullCombined.match(/(\d+\s*[a-zA-Z\d\s+\-*^²³=/]+=\s*\d+)/);
  if (match && /[xyXY]/.test(match[1])) {
    return match[1].trim();
  }

  // 4. Return line with digits and variables if available so user gets partial detected text
  for (const item of scoredLines) {
    if (/\d/.test(item.line) && /[xyXY]/.test(item.line)) {
      return item.line;
    }
  }

  // 5. Pure arithmetic/scientific expression with digits and math operators (e.g. 25 * 4 + 10, sqrt(144) + 8)
  for (const item of scoredLines) {
    if (
      item.score > 0 &&
      /\d/.test(item.line) &&
      (/[+\-*^/]/.test(item.line) || /\b(sqrt|sin|cos|tan|log|ln)\b/i.test(item.line))
    ) {
      return item.line;
    }
  }

  // Strictly return empty string rather than non-math words or incomplete fragments
  return "";
}
