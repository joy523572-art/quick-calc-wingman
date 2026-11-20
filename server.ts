import express, { type Request, type Response } from "express";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    return null;
  }
  return new GoogleGenAI({
    apiKey: apiKey.trim(),
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

const MATH_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    detectedEquation: {
      type: Type.STRING,
      description:
        "Exact handwritten or printed math expression or equation(s) transcribed clearly using standard math notation (e.g. 2x + 5 = 15, x^2 - 5x + 6 = 0, sqrt(144) + 8).",
    },
    mathType: {
      type: Type.STRING,
      description:
        "Category such as arithmetic, linear, quadratic, polynomial, system, trigonometry, calculus, or unreadable.",
    },
    summary: {
      type: Type.STRING,
      description:
        "Final concise answer (e.g. 'x = 5', 'x = 3 or 2', 'x = 6, y = 4', or '= 20').",
    },
    steps: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Clear, ordered step-by-step mathematical working.",
    },
    formulaNote: {
      type: Type.STRING,
      description: "Short rule or formula explanation used to solve the problem.",
    },
    roots: {
      type: Type.ARRAY,
      items: { type: Type.NUMBER },
      description: "Numeric solutions/roots if applicable.",
    },
  },
  required: ["detectedEquation", "mathType", "summary", "steps"],
};

const SYSTEM_INSTRUCTION = `You are an expert low-light, blurry, and handwritten mathematics vision reader and step-by-step solver.
Carefully examine every visual detail—even in dim night lighting, heavy shadows, motion blur, camera defocus, faint pencil, or messy cursive handwriting:
- When two images are provided, Image 1 is the exposure-lifted natural photo and Image 2 is a local-contrast night-vision & sharpened pass of the exact same handwritten document. Cross-reference BOTH images to resolve faint strokes, blurred digits, fractions (a/b), exponents (x^2), square roots (sqrt(...)), parentheses, systems of equations, trigonometry, logarithms, and arithmetic.
- NEVER invent unrelated numbers; carefully decode actual strokes from both views. If a handwritten document has multiple lines of working or multiple problems, transcribe the primary unsolved problem or system clearly and solve it step-by-step.
- Only set mathType to "unreadable" if there is genuinely no visible mathematical writing in either image.
- Solve the transcribed mathematics with 100% accuracy and provide concise, clear ordered steps.`;

async function createApp() {
  const app = express();
  app.use(express.json({ limit: "18mb" }));

  app.post("/api/solve-math-image", async (req: Request, res: Response) => {
    try {
      const { imageBase64, enhancedImageBase64, mimeType } = req.body as {
        imageBase64?: string;
        enhancedImageBase64?: string;
        mimeType?: string;
      };

      if (!imageBase64 || typeof imageBase64 !== "string") {
        res.status(400).json({ error: "Image data is required." });
        return;
      }

      const ai = getGeminiClient();
      if (!ai) {
        res.status(503).json({ error: "Server math vision service is not configured." });
        return;
      }

      const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, "");
      const cleanEnhancedBase64 =
        typeof enhancedImageBase64 === "string" && enhancedImageBase64.trim()
          ? enhancedImageBase64.replace(/^data:[^;]+;base64,/, "")
          : null;
      const safeMime =
        typeof mimeType === "string" && mimeType.startsWith("image/")
          ? mimeType
          : "image/jpeg";

      const parts: Array<
        { inlineData: { mimeType: string; data: string } } | { text: string }
      > = [
        {
          inlineData: {
            mimeType: safeMime,
            data: cleanBase64,
          },
        },
      ];

      if (cleanEnhancedBase64) {
        parts.push({
          inlineData: {
            mimeType: "image/jpeg",
            data: cleanEnhancedBase64,
          },
        });
      }

      parts.push({
        text: cleanEnhancedBase64
          ? "Read the handwritten math from these two views (natural photo + night-vision deblurred contrast view) even if dark, blurry, or faint. Transcribe the exact equation/expression and solve it completely."
          : "Read the handwritten or printed math in this photo even if dim, shadowed, or slightly blurry. Transcribe the exact equation/expression and solve it completely.",
      });

      const response = await ai.models.generateContent({
        model: "gemini-4-hydrogen",
        contents: { parts },
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          thinkingConfig: { thinkingLevel: ThinkingLevel.XHIGH },
          responseMimeType: "application/json",
          responseSchema: MATH_RESPONSE_SCHEMA,
        },
      });

      const rawText = (response.text ?? "{}").trim();
      const parsed = JSON.parse(rawText);
      res.json(parsed);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to analyze math image.";
      console.error("[/api/solve-math-image] error:", message);
      res.status(500).json({ error: message });
    }
  });

  app.post("/api/solve-math-text", async (req: Request, res: Response) => {
    try {
      const { equation } = req.body as { equation?: string };
      if (!equation || typeof equation !== "string" || !equation.trim()) {
        res.status(400).json({ error: "Equation text is required." });
        return;
      }

      const ai = getGeminiClient();
      if (!ai) {
        res.status(503).json({ error: "Server math AI service is not configured." });
        return;
      }

      const response = await ai.models.generateContent({
        model: "gemini-4-hydrogen",
        contents: `Solve the following mathematical expression or equation accurately with step-by-step working: ${equation.trim()}`,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
          responseSchema: MATH_RESPONSE_SCHEMA,
        },
      });

      const rawText = (response.text ?? "{}").trim();
      const parsed = JSON.parse(rawText);
      res.json(parsed);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to solve math expression.";
      console.error("[/api/solve-math-text] error:", message);
      res.status(500).json({ error: message });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, "dist");
    app.use(express.static(distDir));
    app.get("*", (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Nume Scientific Calculator server listening on http://0.0.0.0:${PORT}`);
  });
}

void createApp();
