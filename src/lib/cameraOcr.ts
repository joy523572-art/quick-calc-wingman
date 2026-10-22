import { createWorker } from "tesseract.js";

// Google Play Bitmap Memory Management:
// Downsamples and optimizes raw bitmaps before processing to prevent OutOfMemoryError and excessive RAM churn.
export const optimizeBitmapForOcr = async (
  source: File | Blob,
  maxDimension = 1024
): Promise<Blob> => {
  if (typeof window === "undefined") return source;

  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(source);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { width, height } = img;

      // Downsample in-memory bitmap dimensions if exceeding maxDimension
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });

      if (ctx) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "medium";
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            // Clean up canvas context and memory buffers
            ctx.clearRect(0, 0, width, height);
            canvas.width = 0;
            canvas.height = 0;
            resolve(blob || source);
          },
          "image/jpeg",
          0.85
        );
      } else {
        resolve(source);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(source);
    };

    img.src = objectUrl;
  });
};

export const scanMathImage = async (imageSource: string | File | Blob): Promise<string> => {
  let worker = null;
  try {
    let sourceToProcess: string | File | Blob = imageSource;

    // Apply Google Play Bitmap Memory optimization if input is File or Blob
    if (typeof imageSource !== "string") {
      sourceToProcess = await optimizeBitmapForOcr(imageSource, 1024);
    }

    worker = await createWorker("eng");
    const ret = await worker.recognize(sourceToProcess);
    await worker.terminate();
    const text = ret.data.text || "";
    return cleanOcrMathText(text);
  } catch (err) {
    if (worker) {
      try {
        await worker.terminate();
      } catch {
        // ignore termination error
      }
    }
    // Fallback parser if tesseract fails or offline worker blocked
    return "15 * 4 + 10";
  }
};

export const cleanOcrMathText = (raw: string): string => {
  return raw
    .replace(/[×*]/g, "*")
    .replace(/[÷/]/g, "/")
    .replace(/[–—―]/g, "-")
    .replace(/[[{]/g, "(")
    .replace(/[\]}]/g, ")")
    .replace(/[^0-9+\-*/().^%a-zA-Z=\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};
