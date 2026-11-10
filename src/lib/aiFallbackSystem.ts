import { solveEquation, EquationSolution } from "./equationSolver";
import { convertMeasurement, UnitCategory } from "./unitConversion";

export const CIRCUIT_BREAKER_KEY = "lovable_ai_credits_depleted_month";

export type AiProviderName =
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
    const url = `https://text.pollinations.ai/${encodeURIComponent(prompt)}?model=mistral&seed=42`;
    const res = await fetch(url, { signal: AbortSignal.timeout(4500) });
    if (!res.ok) return null;
    const text = await res.text();
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
      signal: AbortSignal.timeout(3500),
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
      signal: AbortSignal.timeout(3500),
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

/**
 * Main Silent AI Solver Fallback Pipeline for Equation Solving
 * Always calls Lovable Cloud credits first -> Pollinations -> Kilo -> OVHcloud -> Wikipedia -> Local Math.
 * Guaranteed zero error: never throws or crashes.
 */
export async function solveEquationWithAiFallback(equation: string): Promise<EquationAiResult> {
  // Always compute deterministic local math base so we have guaranteed accuracy
  let localBase: EquationSolution;
  try {
    localBase = solveEquation(equation);
  } catch (err: unknown) {
    const message = (err as Error)?.message || "Check syntax, e.g. 2x + 5 = 15.";
    localBase = {
      summary: "Invalid Equation Syntax",
      steps: [message],
      roots: [],
    };
  }

  const prompt = `Solve algebraic equation: ${equation}. Provide concise step-by-step working and final answer for x.`;

  // 1. Primary Provider: Lovable Cloud credits
  try {
    const lovable = await callLovableCloud("solve_equation", { equation });
    if (lovable.success && lovable.data?.summary) {
      return {
        ...localBase,
        summary: lovable.data.summary || localBase.summary,
        steps: Array.isArray(lovable.data.steps) && lovable.data.steps.length > 0 ? lovable.data.steps : localBase.steps,
        providerUsed: "Lovable Cloud",
        formulaNote: lovable.data.formulaNote,
      };
    }
  } catch {
    // Silently continue down fallback chain
  }

  // 2. Pollinations AI (keyless)
  try {
    const pollText = await callPollinationsAi(prompt);
    if (pollText) {
      const parsed = parseAiSteps(pollText, localBase.summary);
      return {
        ...localBase,
        summary: parsed.summary,
        steps: parsed.steps.length > 0 ? parsed.steps : localBase.steps,
        providerUsed: "Pollinations AI (Keyless)",
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
      return {
        ...localBase,
        summary: parsed.summary,
        steps: parsed.steps.length > 0 ? parsed.steps : localBase.steps,
        providerUsed: "Kilo AI Gateway",
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
      return {
        ...localBase,
        summary: parsed.summary,
        steps: parsed.steps.length > 0 ? parsed.steps : localBase.steps,
        providerUsed: "OVHcloud AI",
      };
    }
  } catch {
    // Silently continue
  }

  // 5. Wikipedia API (for mathematical formulas and definitions)
  try {
    const isQuadratic = equation.includes("²") || equation.includes("^2");
    const wikiTerm = isQuadratic ? "Quadratic_equation" : "Linear_equation";
    const wikiSummary = await fetchWikipediaSummary(wikiTerm);
    if (wikiSummary) {
      return {
        ...localBase,
        providerUsed: "Wikipedia API",
        definition: wikiSummary,
        formulaNote: isQuadratic
          ? "Standard quadratic form: ax² + bx + c = 0, solved via discriminant Δ = b² - 4ac."
          : "Standard linear form: ax + b = 0, solved via isolate x = -b/a.",
      };
    }
  } catch {
    // Silently continue
  }

  // 6. Local Math Engine (Zero-Network fallback)
  return {
    ...localBase,
    providerUsed: "Local Deterministic Engine",
  };
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
