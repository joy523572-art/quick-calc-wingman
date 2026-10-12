import { useState, useEffect, useCallback, useRef } from "react";
import { evaluate } from "mathjs";
import { Moon, Sun, Delete, History as HistoryIcon, Trash2, FileDown, Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { noteSuccessfulCalculation } from "@/lib/inAppReview";
import {
  canSaveFreeHistory,
  consumeDailyHistorySave,
  getDailyHistorySaveCount,
  FREE_LIMITS,
} from "@/lib/freemium";
import { downloadHistoryPdf } from "@/lib/historyExport";
import { readCalculationHistory, broadcastHistoryUpdate, type HistoryRecord } from "@/lib/historyStore";

interface CalculatorProps {
  isPro?: boolean;
  onRequestUpgrade?: (feature: string) => void;
  hideHeader?: boolean;
}

const STORAGE_HISTORY = "calc.history.v1";
const STORAGE_THEME = "calc.theme.v1";

const Calculator: React.FC<CalculatorProps> = ({
  isPro = false,
  onRequestUpgrade,
  hideHeader = false,
}) => {
  const [expr, setExpr] = useState("");
  const [result, setResult] = useState("");
  const [isRad, setIsRad] = useState(true);
  const [isInv, setIsInv] = useState(false);
  const [memory, setMemory] = useState(0);
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [dark, setDark] = useState(false);
  const [saveQuotaNotice, setSaveQuotaNotice] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_THEME);
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = stored ? stored === "dark" : prefersDark;
    setDark(isDark);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem(STORAGE_THEME, dark ? "dark" : "light");
  }, [dark]);

  useEffect(() => {
    try {
      const records = readCalculationHistory();
      setHistory(records);
    } catch {
      // ignore parse error
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_HISTORY, JSON.stringify(history.slice(0, 50)));
  }, [history]);

  useEffect(() => {
    if (!expr) {
      setResult("");
      return;
    }
    try {
      const r = evaluate(normalize(expr), buildScope(isRad));
      if (r === undefined || r === null || typeof r === "function") setResult("");
      else setResult(formatResult(r));
    } catch {
      setResult("");
    }
  }, [expr, isRad]);

  const append = (s: string) => setExpr((e) => e + s);
  const clear = () => {
    setExpr("");
    setResult("");
    setSaveQuotaNotice(null);
  };
  const back = () => setExpr((e) => e.slice(0, -1));

  const equals = useCallback(() => {
    if (!expr) return;
    try {
      const r = evaluate(normalize(expr), buildScope(isRad));
      if (r === undefined || r === null || typeof r === "function") return;
      const formatted = formatResult(r);
      if (formatted === "Error") {
        setResult("Error");
        return;
      }

      // Calculations on the scientific calculator are ALWAYS unlimited.
      // Saving to persistent history enforces daily limit for free users.
      const now = new Date().toISOString();
      const canSave = isPro || canSaveFreeHistory();

      if (canSave) {
        if (!isPro) {
          consumeDailyHistorySave();
        }
        setHistory((h) => [{ expr, result: formatted, createdAt: now }, ...h].slice(0, 50));
        broadcastHistoryUpdate();
        setSaveQuotaNotice(null);
      } else {
        setSaveQuotaNotice("Daily history limit reached (3/3). Upgrade to PRO for unlimited history.");
      }

      noteSuccessfulCalculation();
      setExpr(formatted);
      setResult("");
    } catch {
      setResult("Error");
    }
  }, [expr, isRad, isPro]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === "=") {
        e.preventDefault();
        equals();
      } else if (e.key === "Backspace") {
        back();
      } else if (e.key === "Escape") {
        clear();
      } else if (/^[0-9+\-*/().%^!]$/.test(e.key)) {
        append(e.key);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [equals]);

  const exprRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (exprRef.current) exprRef.current.scrollLeft = exprRef.current.scrollWidth;
  }, [expr]);
  useEffect(() => {
    if (resultRef.current) resultRef.current.scrollLeft = resultRef.current.scrollWidth;
  }, [result]);

  const shown = groupDigits(result) || groupDigits(expr);
  const resultSizeClass =
    shown.length > 22
      ? "text-xl"
      : shown.length > 16
      ? "text-2xl"
      : shown.length > 11
      ? "text-3xl"
      : "text-4xl sm:text-5xl";

  const fnLabel = (a: string, b: string) => (isInv ? b : a);


  const sciButtons: { label: string; onClick: () => void; cls?: string }[] = [
    { label: isInv ? "x³" : "x²", onClick: () => append(isInv ? "^3" : "^2") },
    { label: fnLabel("sin", "asin"), onClick: () => append(isInv ? "asin(" : "sin(") },
    { label: fnLabel("cos", "acos"), onClick: () => append(isInv ? "acos(" : "cos(") },
    { label: fnLabel("tan", "atan"), onClick: () => append(isInv ? "atan(" : "tan(") },
    { label: fnLabel("ln", "eˣ"), onClick: () => append(isInv ? "exp(" : "log(") },
    { label: fnLabel("log", "10ˣ"), onClick: () => append(isInv ? "10^" : "log10(") },
    { label: "√", onClick: () => append("sqrt(") },
    { label: "xʸ", onClick: () => append("^") },
    { label: "x!", onClick: () => append("!") },
    { label: "π", onClick: () => append("pi") },
    { label: "e", onClick: () => append("e") },
    { label: "(", onClick: () => append("(") },
    { label: ")", onClick: () => append(")") },
    { label: "1/x", onClick: () => append("1/(") },
    { label: "|x|", onClick: () => append("abs(") },
    { label: "mod", onClick: () => append(" mod ") },
  ];

  const historySheet = (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size={hideHeader ? "sm" : "icon"}
          className={hideHeader ? "h-7 text-xs gap-1 px-2 text-muted-foreground hover:text-foreground" : ""}
          aria-label="History"
        >
          <HistoryIcon className="h-4 w-4" />
          {hideHeader && <span>History</span>}
        </Button>
      </SheetTrigger>
      <SheetContent className="flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center justify-between">
            <span>History</span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1"
                onClick={() => {
                  if (isPro) {
                    downloadHistoryPdf(history);
                  } else {
                    onRequestUpgrade?.("PDF History Export");
                  }
                }}
                disabled={history.length === 0}
                aria-label="Export history to PDF"
              >
                <FileDown className="h-3.5 w-3.5" />
                PDF {!isPro && <Lock className="h-3 w-3 ml-0.5 text-muted-foreground" />}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-muted-foreground"
                onClick={() => setHistory([])}
                aria-label="Clear history"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Clear
              </Button>
            </div>
          </SheetTitle>
        </SheetHeader>

        <div className="text-xs px-1 py-1.5 rounded-lg bg-muted/60 text-muted-foreground flex items-center justify-between mt-2">
          <span>
            {isPro ? (
              <span className="text-primary font-medium flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> PRO: Unlimited Saves
              </span>
            ) : (
              `Free saves today: ${getDailyHistorySaveCount()} / ${FREE_LIMITS.dailyHistorySaves}`
            )}
          </span>
          {!isPro && (
            <button
              onClick={() => onRequestUpgrade?.("History Saving")}
              className="text-primary font-medium hover:underline text-[11px]"
            >
              Go Unlimited
            </button>
          )}
        </div>

        <div className="mt-2 space-y-2 overflow-y-auto flex-1 pr-1">
          {history.length === 0 && (
            <p className="text-sm text-muted-foreground pt-4 text-center">
              No calculations saved yet.
            </p>
          )}
          {history.map((h, i) => (
            <button
              key={i}
              onClick={() => setExpr(h.result)}
              className="w-full text-left p-3 rounded-lg bg-muted hover:bg-secondary transition"
            >
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-0.5">
                <span className="truncate">{groupDigits(h.expr)}</span>
                {h.createdAt && (
                  <span className="text-[10px] opacity-75 shrink-0 ml-2">
                    {new Date(h.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                )}
              </div>
              <div className="text-lg font-semibold truncate">
                = {groupDigits(h.result)}
              </div>
            </button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );

  return (
    <div className={hideHeader ? "w-full max-w-md mx-auto" : "min-h-[100dvh] flex items-center justify-center p-4 sm:p-6 pb-24"}>
      <div className="w-full max-w-md mx-auto">
        {!hideHeader ? (
          <header className="flex items-center justify-between mb-4 px-1">
            <h1 className="text-xl font-semibold tracking-tight">
              Sci<span className="text-primary">Calc</span>
            </h1>
            <div className="flex items-center gap-1">
              {historySheet}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDark((d) => !d)}
                aria-label="Toggle theme"
              >
                {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </Button>
            </div>
          </header>
        ) : (
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-xs font-medium text-muted-foreground">Standard Calculation</span>
            {historySheet}
          </div>
        )}

        <section
          className="rounded-3xl p-5 sm:p-6 mb-4 text-display-foreground"
          style={{ background: "var(--gradient-display)" }}
          aria-live="polite"
        >
          <div className="flex justify-between text-xs opacity-70 mb-2">
            <div className="flex gap-2">
              <button
                onClick={() => setIsRad((v) => !v)}
                className={`px-2 py-0.5 rounded ${
                  isRad ? "bg-primary text-primary-foreground" : "bg-white/10"
                }`}
              >
                {isRad ? "RAD" : "DEG"}
              </button>
              <button
                onClick={() => setIsInv((v) => !v)}
                className={`px-2 py-0.5 rounded ${
                  isInv ? "bg-primary text-primary-foreground" : "bg-white/10"
                }`}
              >
                INV
              </button>
              {memory !== 0 && <span className="px-2 py-0.5 rounded bg-white/10">M</span>}
            </div>
          </div>
          <div
            ref={exprRef}
            className="min-h-[1.75rem] text-right text-base opacity-80 overflow-x-auto whitespace-nowrap no-scrollbar"
          >
            {groupDigits(expr) || "0"}
          </div>
          <div
            ref={resultRef}
            className={`text-right font-semibold tracking-tight min-h-[3.5rem] flex items-center justify-end overflow-x-auto whitespace-nowrap no-scrollbar ${resultSizeClass}`}
          >
            {groupDigits(result) || (expr ? "" : "0")}
          </div>

          {saveQuotaNotice && (
            <div className="mt-2 pt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-amber-300">
              <span className="truncate">{saveQuotaNotice}</span>
              <button
                type="button"
                onClick={() => onRequestUpgrade?.("Unlimited History Saves")}
                className="underline ml-2 shrink-0 font-medium hover:text-white"
              >
                Go PRO
              </button>
            </div>
          )}
        </section>

        <div className="grid grid-cols-5 gap-2 mb-2">
          {[
            { l: "MC", a: () => setMemory(0) },
            { l: "MR", a: () => append(String(memory)) },
            { l: "M+", a: () => { const n = Number(result); if (isFinite(n)) setMemory((m) => m + n); } },
            { l: "M−", a: () => { const n = Number(result); if (isFinite(n)) setMemory((m) => m - n); } },
            { l: "MS", a: () => { const n = Number(result); if (isFinite(n)) setMemory(n); } },
          ].map((b) => (
            <button key={b.l} onClick={b.a} className="calc-key-fn text-xs py-2">
              {b.l}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-4 gap-2 mb-2">
          {sciButtons.map((b) => (
            <button key={b.label} onClick={b.onClick} className="calc-key-fn py-3">
              {b.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-4 gap-2">
          <button onClick={clear} className="calc-key-fn py-4 text-destructive font-semibold">
            AC
          </button>
          <button onClick={back} className="calc-key-fn py-4" aria-label="Backspace">
            <Delete className="h-5 w-5 mx-auto" />
          </button>
          <button onClick={() => append("%")} className="calc-key-fn py-4">
            %
          </button>
          <button onClick={() => append("/")} className="calc-key-op py-4 text-xl">
            ÷
          </button>

          {[7, 8, 9].map((n) => (
            <button key={n} onClick={() => append(String(n))} className="calc-key-num py-4 text-xl">
              {n}
            </button>
          ))}
          <button onClick={() => append("*")} className="calc-key-op py-4 text-xl">
            ×
          </button>

          {[4, 5, 6].map((n) => (
            <button key={n} onClick={() => append(String(n))} className="calc-key-num py-4 text-xl">
              {n}
            </button>
          ))}
          <button onClick={() => append("-")} className="calc-key-op py-4 text-xl">
            −
          </button>

          {[1, 2, 3].map((n) => (
            <button key={n} onClick={() => append(String(n))} className="calc-key-num py-4 text-xl">
              {n}
            </button>
          ))}
          <button onClick={() => append("+")} className="calc-key-op py-4 text-xl">
            +
          </button>

          <button
            onClick={() =>
              setExpr((e) => (e.startsWith("-") ? e.slice(1) : "-" + e))
            }
            className="calc-key-num py-4 text-xl"
          >
            ±
          </button>
          <button onClick={() => append("0")} className="calc-key-num py-4 text-xl">
            0
          </button>
          <button onClick={() => append(".")} className="calc-key-num py-4 text-xl">
            .
          </button>
          <button onClick={equals} className="calc-key-eq py-4 text-2xl font-semibold">
            =
          </button>
        </div>

        <footer className="mt-6 text-center text-xs text-muted-foreground">
          <p>Works offline · No data collected · No account required</p>
        </footer>
      </div>
    </div>
  );
};

function groupDigits(s: string) {
  if (!s) return "";
  if (/e[+-]?\d/i.test(s)) return s;
  return s.replace(/\d+(\.\d+)?/g, (m) => {
    const [int, dec] = m.split(".");
    const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return dec !== undefined ? `${grouped}.${dec}` : grouped;
  });
}

function normalize(s: string) {
  return s.replace(/,/g, "").replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-");
}

function buildScope(rad: boolean) {
  if (rad) return {};
  const toRad = (x: number) => (x * Math.PI) / 180;
  const toDeg = (x: number) => (x * 180) / Math.PI;
  return {
    sin: (x: number) => Math.sin(toRad(x)),
    cos: (x: number) => Math.cos(toRad(x)),
    tan: (x: number) => Math.tan(toRad(x)),
    asin: (x: number) => toDeg(Math.asin(x)),
    acos: (x: number) => toDeg(Math.acos(x)),
    atan: (x: number) => toDeg(Math.atan(x)),
  };
}

function formatResult(r: unknown): string {
  if (typeof r === "number") {
    if (!isFinite(r)) return "Error";
    const rounded = Math.round(r * 1e12) / 1e12;
    return String(rounded);
  }
  return String(r);
}

export default Calculator;
