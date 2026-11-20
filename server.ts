import express, { type Request, type Response } from "express";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI, Type } from "@google/genai";

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

const SYSTEM_INSTRUCTION = `You are a precision handwritten mathematics OCR reader and step-by-step solver.
Carefully inspect the image or equation input:
- Read ALL handwritten or printed math accurately: digits, variables, fractions (a/b), exponents (x^2), square roots (sqrt(...)), parentheses, systems of equations (separated by commas or newlines), trigonometry, logarithms, and arithmetic expressions.
- NEVER invent or alter digits that are not visible in the image.
- If multiple lines appear, focus on the primary mathematical expression or system of equations; if unreadable or containing no math, set mathType to "unreadable" and detectedEquation to "".
- Solve the transcribed math with 100% mathematical accuracy and show clear step-by-step working.
- Keep explanations concise and direct.`;

async function createApp() {
  const app = express();
  app.use(express.json({ limit: "12mb" }));

  app.post("/api/solve-math-image", async (req: Request, res: Response) => {
    try {
      const { imageBase64, mimeType } = req.body as {
        imageBase64?: string;
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
      const safeMime =
        typeof mimeType === "string" && mimeType.startsWith("image/")
          ? mimeType
          : "image/jpeg";

      const response = await ai.models.generateContent({
        model: "gemini-4-hydrogen",
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: safeMime,
                data: cleanBase64,
              },
            },
            {
              text: "Transcribe the handwritten or printed mathematics in this image accurately and solve it completely with step-by-step working.",
            },
          ],
        },
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
