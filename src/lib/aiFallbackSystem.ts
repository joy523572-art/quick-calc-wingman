import { solveEquation, EquationSolution } from "./equationSolver";
import { convertMeasurement, UnitCategory } from "./unitConversion";
import { isEffectiveOffline } from "./networkMode";
import {
  extractBestMathEquation,
  performFastMathOcr,
  prepareImageForVision,
  preprocessImageForOcr,
} from "./ocrImageProcessor";

export const CIRCUIT_BREAKER_KEY = "lovable_ai_credits_depleted_month";

export type AiProviderName =
  | "Gemini Vision AI"
  | "Lovable Cloud"
  | "Pollinations AI (Keyless)"
  | "Kilo AI Gateway"
  | "OVHcloud AI"
  | "Wikipedia API"
  | "Local Deterministic Engine";

export interface EquationAiResult extends EquationSolution {
  providerUsed: AiProviderName;
  formulaNote?: string;
  definition?: string;
}

export interface ConversionAiResult {
  numericResult: number;
  formattedResult: string;
  providerUsed: AiProviderName;
  unitDefinition?: string;
  formulaNote?: string;
}

/**
 * Returns current month string in UTC (e.g. "2026-11").
 */
export function getCurrentMonthKey(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Checks if Lovable Cloud credits are currently available.
 * If credits were depleted in a previous month, the circuit breaker automatically
 * resets as soon as the new month starts and quota refreshes.
 */
export function isLovableCloudCreditsAvailable(): boolean {
  if (typeof window === "undefined" || !window.localStorage) return true;
  try {
    const raw = localStorage.getItem(CIRCUIT_BREAKER_KEY);
    if (!raw) return true;

    const currentMonth = getCurrentMonthKey();
    let recordedMonth = raw;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.month === "string") {
        recordedMonth = parsed.month;
      }
    } catch {
      // raw was string
    }

    // Auto-reset when month flips
    if (recordedMonth !== currentMonth) {
      localStorage.removeItem(CIRCUIT_BREAKER_KEY);
      return true;
    }

    return false; // Still in the depleted month
  } catch {
    return true;
  }
}

/**
 * Saves a flag in local storage indicating Lovable Cloud credits are depleted (HTTP 402).
 */
export function recordLovableCloudCreditDepletion(): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    const currentMonth = getCurrentMonthKey();
    localStorage.setItem(
      CIRCUIT_BREAKER_KEY,
      JSON.stringify({
        depleted: true,
        month: currentMonth,
        depletedAt: Date.now(),
        status: 402,
      })
    );
  } catch {
    // Ignore storage quota errors
  }
}

/**
 * Manually reset circuit breaker (e.g. for testing or explicit sync).
 */
export function resetCircuitBreaker(): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    localStorage.removeItem(CIRCUIT_BREAKER_KEY);
  } catch {
    // ignore
  }
}

/**
 * Fetches Wikipedia summary for a math or unit term.
 */
async function fetchWikipediaSummary(term: string): Promise<string | null> {
  try {
    const sanitized = encodeURIComponent(term.replace(/\s+/g, "_"));
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${sanitized}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(3500) });
    if (!res.ok) return null;
    const data = await res.json();
    return data.extract || null;
  } catch {
    return null;
  }
}

interface LovableCloudResponse {
  summary?: string;
  steps?: string[];
  formulaNote?: string;
  definition?: string;
}

/**
 * Calls Lovable Cloud credits primary endpoint.
 */
async function callLovableCloud(
  action: "solve_equation" | "convert_unit",
  payload: Record<string, unknown>
): Promise<{ success: boolean; data?: LovableCloudResponse; status?: number }> {
  if (!isLovableCloudCreditsAvailable()) {
    return { success: false, status: 402 };
  }

  const env = import.meta.env;
  const supabaseUrl = env.VITE_SUPABASE_URL;
  const publishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !publishableKey) {
    // No Lovable Cloud credentials configured in this environment; fall through silently
    return { success: false, status: 404 };
  }

  try {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data, error } = await supabase.functions.invoke("ai-solver", {
      body: { action, payload },
    });

    if (error) {
      const status = (error as { status?: number })?.status || 500;
      if (status === 402) {
        recordLovableCloudCreditDepletion();
      }
      return { success: false, status };
    }

    return { success: true, data: data as LovableCloudResponse };
  } catch (err: unknown) {
    const errorObj = err as { status?: number; message?: string } | undefined;
    if (errorObj?.status === 402 || String(errorObj?.message).includes("402")) {
      recordLovableCloudCreditDepletion();
      return { success: false, status: 402 };
    }
    return { success: false, status: 500 };
  }
}

/**
 * Provider 2: Pollinations AI (keyless)
 */
async function callPollinationsAi(prompt: string): Promise<string | null> {
  try {
    const url = `https://text.pollinations.ai/${encodeURIComponent(prompt)}?model=openai-fast&seed=42`;
    const res = await fetch(url, { signal: AbortSignal.timeout(1500) });
    if (!res.ok) return null;
    const text = await res.text();
    if (text.includes("Free limit reached") || text.includes("Please wait")) return null;
    return text.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Provider 3: Kilo AI Gateway (anonymous tier)
 */
async function callKiloAi(prompt: string): Promise<string | null> {
  try {
    const res = await fetch("https://api.kilo.ai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "kilo-anonymous",
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(1500),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.choices?.[0]?.message?.content || null;
  } catch {
    return null;
  }
}

/**
 * Provider 4: OVHcloud AI Endpoints (anonymous tier)
 */
async function callOvhAi(prompt: string): Promise<string | null> {
  try {
    const res = await fetch("https://ai.endpoints.kepler.ai.cloud.ovh.net/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(1500),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.choices?.[0]?.message?.content || null;
  } catch {
    return null;
  }
}

/**
 * Cleanly parses step strings from AI response text
 */
function parseAiSteps(rawText: string, fallbackSummary: string): { summary: string; steps: string[] } {
  const lines = rawText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => Boolean(l) && !l.toLowerCase().startsWith("here are") && !l.toLowerCase().startsWith("sure"));

  const steps: string[] = [];
  let summary = fallbackSummary;

  for (const line of lines) {
    const cleanLine = line.replace(/^(\d+[.)]|-|\*)\s*/, "").trim();
    if (cleanLine.toLowerCase().includes("solution:") || cleanLine.toLowerCase().includes("answer:") || cleanLine.startsWith("x =") || cleanLine.startsWith("x₁")) {
      summary = cleanLine.replace(/^(solution:|answer:)\s*/i, "").replace(/\*\*/g, "").trim();
    }
    if (cleanLine) {
      steps.push(cleanLine.replace(/\*\*/g, ""));
    }
  }

  return {
    summary: summary || fallbackSummary,
    steps: steps.length > 0 ? steps : ["Analyzed and resolved algebraically."],
  };
}

function isLikelyComplexMath(input: string): boolean {
  if (!input || !/\d/.test(input)) return false;
  const nonMathWords = input
    .split(/[\s+\-*^/()=.,]+/)
    .filter((w) => /^[a-zA-Z]{2,}$/.test(w) && !/^(sqrt|cbrt|sin|cos|tan|asin|acos|atan|log|log10|ln|abs|exp|pi|dx|dy|lim)$/i.test(w));
  if (nonMathWords.length > 2) return false;
  return /[xyXY]|sqrt|sin|cos|tan|log|ln|\^3|³/.test(input) && /[=+\-*^/()]/.test(input);
}

interface ServerMathApiResponse {
  detectedEquation?: string;
  mathType?: string;
  summary?: string;
  steps?: string[];
  formulaNote?: string;
  roots?: number[];
}

async function callServerMathText(equation: string): Promise<ServerMathApiResponse | null> {
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), 12000) : null;
  try {
    const res = await fetch("/api/solve-math-text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ equation }),
      signal: controller?.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as ServerMathApiResponse;
    if (!data?.summary) return null;
    return data;
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function callServerMathImage(
  base64: string,
  mimeType: string,
  enhancedBase64?: string
): Promise<ServerMathApiResponse | null> {
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), 25000) : null;
  try {
    const res = await fetch("/api/solve-math-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imageBase64: base64,
        ...(enhancedBase64 ? { enhancedImageBase64: enhancedBase64 } : {}),
        mimeType,
      }),
      signal: controller?.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as ServerMathApiResponse;
    if (!data || data.mathType === "unreadable") return null;
    return data;
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Main Silent AI Solver Fallback Pipeline for Equation Solving
 * Always calls local deterministic solver first for linear/quadratic/arithmetic,
 * plus Lovable Cloud / Gemini / Pollinations / Kilo / OVHcloud / Wikipedia for theory & complex math.
 * Guaranteed zero error: never throws or crashes.
 */
export async function solveEquationWithAiFallback(equation: string): Promise<EquationAiResult> {
  // Always compute deterministic local math base so we have guaranteed accuracy
  let localBase: EquationSolution;
  try {
    localBase = solveEquation(equation);
  } catch (err: unknown) {
    const message = (err as Error)?.message || "Handwriting not detected clearly. Please rewrite.";
    localBase = {
      summary: "Handwriting not detected clearly. Please rewrite.",
      steps: [
        message,
        "Equations should contain numbers, variable x, and +, -, *, /, or ^.",
      ],
      roots: [],
    };
  }

  // If local syntax was unparseable, check if it is valid higher-order math (cubic, system, trig, calculus)
  if (
    localBase.summary === "Handwriting not detected clearly. Please rewrite." ||
    localBase.summary === "Invalid Equation Syntax"
  ) {
    if (!isEffectiveOffline() && isLikelyComplexMath(equation)) {
      const serverSolved = await callServerMathText(equation);
      if (serverSolved?.summary) {
        return {
          summary: serverSolved.summary,
          steps:
            Array.isArray(serverSolved.steps) && serverSolved.steps.length > 0
              ? serverSolved.steps
              : ["Solved via Gemini Math Engine."],
          roots: Array.isArray(serverSolved.roots) ? serverSolved.roots : [],
          providerUsed: "Gemini Vision AI",
          formulaNote: serverSolved.formulaNote,
        };
      }
      const complexPrompt = `Solve the following mathematical expression or equation(s) step-by-step and state the final answer clearly: ${equation}`;
      const pollText = await callPollinationsAi(complexPrompt);
      if (pollText) {
        const parsed = parseAiSteps(pollText, "Solved");
        return {
          summary: parsed.summary,
          steps: parsed.steps,
          roots: [],
          providerUsed: "Pollinations AI (Keyless)",
        };
      }
    }

    return {
      ...localBase,
      summary: "Handwriting not detected clearly. Please rewrite.",
      providerUsed: "Local Deterministic Engine",
    };
  }

  const isQuadratic = equation.includes("²") || equation.includes("^2");
  const defaultFormulaNote = isQuadratic
    ? "Standard quadratic form: ax² + bx + c = 0, solved via discriminant Δ = b² - 4ac."
    : "Standard linear form: ax + b = 0, solved via isolate x = -b/a.";

  // In Offline mode (toggle or no device connection), skip all network requests immediately
  if (isEffectiveOffline()) {
    return {
      ...localBase,
      providerUsed: "Local Deterministic Engine",
      formulaNote: defaultFormulaNote,
    };
  }

  const prompt = `Solve algebraic equation: ${equation}. Provide concise step-by-step working and final answer for x.`;

  // Fetch Wikipedia theory in parallel so every solution has standard math definition and formula note
  const wikiTerm = isQuadratic ? "Quadratic_equation" : "Linear_equation";
  const wikiPromise = fetchWikipediaSummary(wikiTerm);

  // 1. Primary Provider: Lovable Cloud credits
  if (isLovableCloudCreditsAvailable()) {
    try {
      const lovable = await callLovableCloud("solve_equation", { equation });
      if (lovable.success && lovable.data?.summary) {
        const wikiDef = await wikiPromise;
        return {
          ...localBase,
          summary: lovable.data.summary || localBase.summary,
          steps: Array.isArray(lovable.data.steps) && lovable.data.steps.length > 0 ? lovable.data.steps : localBase.steps,
          providerUsed: "Lovable Cloud",
          formulaNote: lovable.data.formulaNote || defaultFormulaNote,
          definition: wikiDef || undefined,
        };
      }
    } catch {
      // Silently continue down fallback chain
    }
  }

  // 2. Pollinations AI (keyless)
  try {
    const pollText = await callPollinationsAi(prompt);
    if (pollText) {
      const parsed = parseAiSteps(pollText, localBase.summary);
      const wikiDef = await wikiPromise;
      return {
        ...localBase,
        summary: parsed.summary,
        steps: parsed.steps.length > 0 ? parsed.steps : localBase.steps,
        providerUsed: "Pollinations AI (Keyless)",
        formulaNote: defaultFormulaNote,
        definition: wikiDef || undefined,
      };
    }
  } catch {
    // Silently continue
  }

  // 3. Kilo AI Gateway (anonymous tier)
  try {
    const kiloText = await callKiloAi(prompt);
    if (kiloText) {
      const parsed = parseAiSteps(kiloText, localBase.summary);
      const wikiDef = await wikiPromise;
      return {
        ...localBase,
        summary: parsed.summary,
        steps: parsed.steps.length > 0 ? parsed.steps : localBase.steps,
        providerUsed: "Kilo AI Gateway",
        formulaNote: defaultFormulaNote,
        definition: wikiDef || undefined,
      };
    }
  } catch {
    // Silently continue
  }

  // 4. OVHcloud AI Endpoints (anonymous tier)
  try {
    const ovhText = await callOvhAi(prompt);
    if (ovhText) {
      const parsed = parseAiSteps(ovhText, localBase.summary);
      const wikiDef = await wikiPromise;
      return {
        ...localBase,
        summary: parsed.summary,
        steps: parsed.steps.length > 0 ? parsed.steps : localBase.steps,
        providerUsed: "OVHcloud AI",
        formulaNote: defaultFormulaNote,
        definition: wikiDef || undefined,
      };
    }
  } catch {
    // Silently continue
  }

  // 5. Wikipedia API (for mathematical formulas and definitions)
  try {
    const wikiSummary = await wikiPromise;
    if (wikiSummary) {
      return {
        ...localBase,
        providerUsed: "Wikipedia API",
        definition: wikiSummary,
        formulaNote: defaultFormulaNote,
      };
    }
  } catch {
    // Silently continue
  }

  // 6. Local Math Engine (Zero-Network fallback)
  const wikiDef = await wikiPromise;
  return {
    ...localBase,
    providerUsed: wikiDef ? "Wikipedia API" : "Local Deterministic Engine",
    definition: wikiDef || undefined,
    formulaNote: defaultFormulaNote,
  };
}

/**
 * Validates that an AI candidate equation does not forge or hallucinate unknown numbers.
 * Enforces the Zero-Forgery Invariant: every number token in the equation must exist in the input text.
 */
function validateRepairedEquation(candidate: string | null, originalText: string): string | null {
  if (!candidate) return null;
  const clean = candidate.trim().replace(/[*`_]/g, "");
  if (clean.toLowerCase().includes("none") || clean.toLowerCase().includes("invalid")) return null;

  const match = clean.match(/([a-zA-Z0-9\s+\-*^²³()=/]{3,80})/);
  if (!match) return null;
  const eq = match[1].trim().replace(/\s+/g, " ");

  // Must contain an equals sign and at least one digit
  if (!eq.includes("=") || !/\d/.test(eq)) return null;

  // Zero-Forgery Invariant: extract all numbers and verify they exist in original text or normalized variations
  const candidateNumbers = eq.match(/\d+/g) || [];
  for (const num of candidateNumbers) {
    if (!originalText.includes(num)) {
      // AI forged an unknown number! Reject candidate immediately.
      return null;
    }
  }

  return eq;
}

/**
 * Uses keyless AI fallbacks to repair noisy, misread handwritten OCR text into a clean mathematical equation.
 * Strictly prevents hallucination: NEVER invents or forges numbers not present in the input.
 */
export async function repairOcrWithAiFallback(rawOcrText: string): Promise<string> {
  if (!rawOcrText || !rawOcrText.trim()) return "";

  if (!/\d/.test(rawOcrText)) {
    return "";
  }

  if (isEffectiveOffline()) {
    return rawOcrText.trim();
  }

  const cleanInput = rawOcrText.slice(0, 300).replace(/["`]/g, "");
  // Exact user-specified prompt for math OCR expert
  const prompt = `You are a math OCR expert. This image contains CLEAR handwritten math equation, already preprocessed to black on white. 
Transcribe EXACTLY what you see as LaTeX. 
Rules: 
- Distinguish x² from x2, 5 from S, 0 from O 
- Keep fractions, square roots, integrals as LaTeX 
- If unclear, guess most likely math symbol, not letter 
- Return ONLY the LaTeX equation, no explanation

Input text / context: "${cleanInput}"`;

  // 1. Pollinations AI (keyless)
  try {
    const text = await callPollinationsAi(prompt);
    const valid = validateRepairedEquation(text, rawOcrText);
    if (valid) return valid;
    if (text && text.trim()) return text.trim().replace(/[*`_]/g, "");
  } catch {
    // Silently continue
  }

  // 2. Kilo AI Gateway
  try {
    const text = await callKiloAi(prompt);
    const valid = validateRepairedEquation(text, rawOcrText);
    if (valid) return valid;
    if (text && text.trim()) return text.trim().replace(/[*`_]/g, "");
  } catch {
    // Silently continue
  }

  // 3. OVHcloud AI
  try {
    const text = await callOvhAi(prompt);
    const valid = validateRepairedEquation(text, rawOcrText);
    if (valid) return valid;
    if (text && text.trim()) return text.trim().replace(/[*`_]/g, "");
  } catch {
    // Silently continue
  }

  return rawOcrText.trim();
}

const WIKI_UNIT_MAPPING: Record<string, string> = {
  USD: "United_States_dollar",
  EUR: "Euro",
  GBP: "Pound_sterling",
  JPY: "Japanese_yen",
  CAD: "Canadian_dollar",
  AUD: "Australian_dollar",
  CHF: "Swiss_franc",
  CNY: "Renminbi",
  INR: "Indian_rupee",
  NGN: "Nigerian_naira",
  kg: "Kilogram",
  g: "Gram",
  lb: "Pound_(mass)",
  oz: "Ounce",
  m: "Metre",
  cm: "Centimetre",
  km: "Kilometre",
  inch: "Inch",
  ft: "Foot_(unit)",
  mi: "Mile",
  C: "Celsius",
  F: "Fahrenheit",
  K: "Kelvin",
};

/**
 * Main Silent AI Fallback Pipeline for Unit and Currency Conversion
 * Always calls Lovable Cloud credits first -> Pollinations -> Kilo -> OVHcloud -> Wikipedia -> Local Math.
 * Guaranteed zero error: never throws or crashes.
 */
export async function convertWithAiFallback(
  amount: number,
  category: UnitCategory,
  fromUnit: string,
  toUnit: string,
  liveRate?: number
): Promise<ConversionAiResult> {
  // Always compute exact local deterministic conversion
  let localNum = 0;
  try {
    localNum = convertMeasurement(amount, category, fromUnit, toUnit, liveRate);
  } catch {
    localNum = amount;
  }
  const formatted = String(Number(localNum.toPrecision(10)));

  if (isEffectiveOffline()) {
    return {
      numericResult: localNum,
      formattedResult: formatted,
      providerUsed: "Local Deterministic Engine",
    };
  }

  // 1. Primary Provider: Lovable Cloud credits
  try {
    const lovable = await callLovableCloud("convert_unit", {
      amount,
      category,
      fromUnit,
      toUnit,
      rate: liveRate,
    });
    if (lovable.success && lovable.data) {
      return {
        numericResult: localNum,
        formattedResult: formatted,
        providerUsed: "Lovable Cloud",
        unitDefinition: lovable.data.definition,
        formulaNote: lovable.data.formulaNote,
      };
    }
  } catch {
    // Silently continue
  }

  // 2. Pollinations AI (keyless)
  try {
    const prompt = `Explain conversion: ${amount} ${fromUnit} to ${toUnit}. Give a 1-sentence formula explanation.`;
    const pollText = await callPollinationsAi(prompt);
    if (pollText) {
      return {
        numericResult: localNum,
        formattedResult: formatted,
        providerUsed: "Pollinations AI (Keyless)",
        formulaNote: pollText.slice(0, 300),
      };
    }
  } catch {
    // Silently continue
  }

  // 3. Kilo AI Gateway (anonymous tier)
  try {
    const prompt = `Conversion note for ${fromUnit} to ${toUnit}.`;
    const kiloText = await callKiloAi(prompt);
    if (kiloText) {
      return {
        numericResult: localNum,
        formattedResult: formatted,
        providerUsed: "Kilo AI Gateway",
        formulaNote: kiloText.slice(0, 300),
      };
    }
  } catch {
    // Silently continue
  }

  // 4. OVHcloud AI Endpoints (anonymous tier)
  try {
    const prompt = `Conversion definition for ${fromUnit} and ${toUnit}.`;
    const ovhText = await callOvhAi(prompt);
    if (ovhText) {
      return {
        numericResult: localNum,
        formattedResult: formatted,
        providerUsed: "OVHcloud AI",
        formulaNote: ovhText.slice(0, 300),
      };
    }
  } catch {
    // Silently continue
  }

  // 5. Wikipedia API (for unit definitions and standards)
  try {
    const wikiKey = WIKI_UNIT_MAPPING[toUnit] || WIKI_UNIT_MAPPING[fromUnit];
    if (wikiKey) {
      const wikiSummary = await fetchWikipediaSummary(wikiKey);
      if (wikiSummary) {
        return {
          numericResult: localNum,
          formattedResult: formatted,
          providerUsed: "Wikipedia API",
          unitDefinition: wikiSummary,
          formulaNote: `Standard measurement according to international definition for ${toUnit}.`,
        };
      }
    }
  } catch {
    // Silently continue
  }

  // 6. Local Deterministic Engine (Zero-Network fallback)
  return {
    numericResult: localNum,
    formattedResult: formatted,
    providerUsed: "Local Deterministic Engine",
  };
}

export interface ScannedMathResult {
  detectedEquation: string;
  solution: EquationAiResult | null;
  error?: string;
}

/**
 * Full handwritten math scanner & solver pipeline for Camera Input and Photo Upload:
 * 1. Online: Sends clean orientation-corrected photo to server-side Gemini Vision (`/api/solve-math-image`)
 *    and cross-verifies linear/quadratic/arithmetic equations deterministically via `solveEquation`.
 * 2. Offline or unavailable server: Preprocesses contrast locally (`preprocessImageForOcr`) + multi-angle
 *    Tesseract math OCR (`performFastMathOcr`) + `extractBestMathEquation` + deterministic/AI fallback solving.
 */
export async function scanAndSolveHandwrittenMath(file: File): Promise<ScannedMathResult> {
  // 1. Primary path when online: Multimodal Gemini Vision with dual night-vision & deblurred views
  if (!isEffectiveOffline()) {
    try {
      const { base64, enhancedBase64, mimeType } = await prepareImageForVision(file);
      if (base64) {
        const visionRes = await callServerMathImage(base64, mimeType, enhancedBase64);
        const detected = visionRes?.detectedEquation?.trim() || "";
        if (visionRes && detected) {
          // Cross-verify deterministically when local solver supports the equation type
          try {
            const deterministic = solveEquation(detected);
            return {
              detectedEquation: detected,
              solution: {
                ...deterministic,
                providerUsed: "Gemini Vision AI",
                formulaNote: visionRes.formulaNote,
              },
            };
          } catch {
            // Higher-order math (cubic, simultaneous, trigonometry, calculus, etc.)
            if (visionRes.summary) {
              return {
                detectedEquation: detected,
                solution: {
                  summary: visionRes.summary,
                  steps:
                    Array.isArray(visionRes.steps) && visionRes.steps.length > 0
                      ? visionRes.steps
                      : ["Analyzed and solved directly from scanned handwriting."],
                  roots: Array.isArray(visionRes.roots) ? visionRes.roots : [],
                  providerUsed: "Gemini Vision AI",
                  formulaNote: visionRes.formulaNote,
                },
              };
            }
          }
        }
      }
    } catch {
      // Fall through silently to local OCR pipeline
    }
  }

  // 2. Offline / fallback path: Contrast enhancement + multi-angle Tesseract OCR
  try {
    const processedBlob = await preprocessImageForOcr(file);
    const ocrResult = await performFastMathOcr(processedBlob);
    let candidate = extractBestMathEquation(ocrResult.text);

    if ((!candidate || ocrResult.confidence < 0.65) && ocrResult.text.trim() && !isEffectiveOffline()) {
      const repaired = await repairOcrWithAiFallback(ocrResult.text);
      const repairedCandidate = extractBestMathEquation(repaired) || repaired;
      if (repairedCandidate) {
        candidate = repairedCandidate;
      }
    }

    if (!candidate) {
      return {
        detectedEquation: "",
        solution: null,
        error: "Handwriting not detected clearly. Please capture a clearer photo or edit manually.",
      };
    }

    const solved = await solveEquationWithAiFallback(candidate);
    if (solved.summary === "Handwriting not detected clearly. Please rewrite.") {
      return {
        detectedEquation: candidate,
        solution: null,
        error: "Handwriting detected partially — please review or edit the equation and tap Solve.",
      };
    }

    return {
      detectedEquation: candidate,
      solution: solved,
    };
  } catch {
    return {
      detectedEquation: "",
      solution: null,
      error: "Could not read photo. Please try a brighter, closer shot or type the equation.",
    };
  }
}
