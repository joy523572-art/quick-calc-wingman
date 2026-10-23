import { useState, useEffect, useCallback, useRef } from "react";
import { evaluate } from "mathjs";
import { Delete, History as HistoryIcon, Trash2, FileDown, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { noteSuccessfulCalculation } from "@/lib/inAppReview";
import { downloadHistoryPdf } from "@/lib/historyExport";
import { canSaveHistory } from "@/lib/freemium";
import { PremiumLock } from "@/components/PremiumLock";

export type HistoryItem = { expr: string; result: string };

const STORAGE_HISTORY = "calc.history.v1";

export interface CalculatorProps {
  isPro?: boolean;
  onRequestUpgrade?: (feature: string) => void;
}

export const Calculator = ({ isPro = false, onRequestUpgrade }: CalculatorProps) => {
  const [expr, setExpr] = useState("");
  const [result, setResult] = useState("");
  const [isRad, setIsRad] = useState(true);
  const [isInv, setIsInv] = useState(false);
  const [memory, setMemory] = useState(0);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_HISTORY);
      if (raw) setHistory(JSON.parse(raw));
    } catch {
      // ignore storage access error
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

      // History saving is premium-only; calculating stays unlimited for everyone.
      if (canSaveHistory(isPro)) {
        setHistory((h) => [{ expr, result: formatted }, ...h].slice(0, 50));
      }

      noteSuccessfulCalculation();
      setExpr(formatted);
      setResult("");
    } catch {
      setResult("Error");
    }
  }, [expr, isRad, isPro]);

  const handleExportPdf = () => {
    if (!isPro) {
      onRequestUpgrade?.("History Saving & PDF Export");
      return;
    }
    const records = history.map((h) => ({
      expr: h.expr,
      result: h.result,
      createdAt: new Date().toISOString(),
    }));
    downloadHistoryPdf(records);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT" || (e.target as HTMLElement)?.tagName === "TEXTAREA") return;
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

  return (
    <div className="w-full max-w-md mx-auto space-y-3">
      {/* Top Bar with History Sheet Trigger */}
      <div className="flex items-center justify-between px-1">
        <div className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
          <span>Scientific Computing</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold">
            Unlimited Free
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Sheet>
            {!isPro ? (
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs rounded-xl"
                aria-label="History (Premium)"
                onClick={() => onRequestUpgrade?.("History Saving")}
              >
                <HistoryIcon className="h-3.5 w-3.5" />
                <span>History</span>
                <Lock className="h-3 w-3 text-primary" />
              </Button>
            ) : (
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs rounded-xl" aria-label="History">
                <HistoryIcon className="h-3.5 w-3.5" />
                <span>History</span>
                <PremiumLock label="PRO" className="ml-0.5" />
              </Button>
            </SheetTrigger>
            )}
            <SheetContent className="w-full sm:max-w-md">
              <SheetHeader>
                <SheetTitle className="flex items-center justify-between text-base">
                  <span>Calculation History</span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleExportPdf}
                      className="h-8 text-xs gap-1 rounded-lg"
                      title="Export calculations as PDF"
                    >
                      <FileDown className="h-3.5 w-3.5" /> PDF
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setHistory([])}
                      className="h-8 text-xs text-destructive hover:text-destructive"
                      aria-label="Clear history"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" /> Clear
                    </Button>
                  </div>
                </SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-2 overflow-y-auto max-h-[80vh] pr-2">
                {history.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No calculations saved yet.
                  </p>
                )}
                {history.map((h, i) => (
                  <button
                    key={i}
                    onClick={() => setExpr(h.result)}
                    className="w-full text-left p-3 rounded-2xl bg-muted/50 hover:bg-muted border border-border/50 transition space-y-0.5"
                  >
                    <div className="text-xs font-mono text-muted-foreground truncate">
                      {groupDigits(h.expr)}
                    </div>
                    <div className="text-base font-mono font-bold text-primary truncate">
                      = {groupDigits(h.result)}
                    </div>
                  </button>
                ))}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Calculator Screen */}
      <section
        className="rounded-3xl p-5 sm:p-6 text-display-foreground border border-border/80 shadow-md"
        style={{ background: "var(--gradient-display)" }}
        aria-live="polite"
      >
        <div className="flex justify-between text-xs opacity-70 mb-2">
          <div className="flex gap-2">
            <button
              onClick={() => setIsRad((v) => !v)}
              className={`px-2.5 py-1 rounded-lg font-bold text-xs transition ${
                isRad ? "bg-primary text-primary-foreground" : "bg-white/10"
              }`}
            >
              {isRad ? "RAD" : "DEG"}
            </button>
            <button
              onClick={() => setIsInv((v) => !v)}
              className={`px-2.5 py-1 rounded-lg font-bold text-xs transition ${
                isInv ? "bg-primary text-primary-foreground" : "bg-white/10"
              }`}
            >
              INV
            </button>
            {memory !== 0 && (
              <span className="px-2 py-0.5 rounded-lg bg-primary/20 text-primary font-bold text-xs">
                M
              </span>
            )}
          </div>
        </div>
        <div
          ref={exprRef}
          className="min-h-[1.75rem] text-right text-base opacity-80 overflow-x-auto whitespace-nowrap no-scrollbar font-mono"
        >
          {groupDigits(expr) || "0"}
        </div>
        <div
          ref={resultRef}
          className={`text-right font-semibold tracking-tight min-h-[3.5rem] flex items-center justify-end overflow-x-auto whitespace-nowrap no-scrollbar font-mono ${resultSizeClass}`}
        >
          {groupDigits(result) || (expr ? "" : "0")}
        </div>
      </section>

      {/* Memory keys */}
      <div className="grid grid-cols-5 gap-1.5">
        {[
          { l: "MC", a: () => setMemory(0) },
          { l: "MR", a: () => append(String(memory)) },
          { l: "M+", a: () => { const n = Number(result); if (isFinite(n)) setMemory((m) => m + n); } },
          { l: "M−", a: () => { const n = Number(result); if (isFinite(n)) setMemory((m) => m - n); } },
          { l: "MS", a: () => { const n = Number(result); if (isFinite(n)) setMemory(n); } },
        ].map((b) => (
          <button key={b.l} onClick={b.a} className="calc-key-fn text-xs py-2 rounded-xl">
            {b.l}
          </button>
        ))}
      </div>

      {/* Scientific keys */}
      <div className="grid grid-cols-4 gap-1.5">
        {sciButtons.map((b) => (
          <button key={b.label} onClick={b.onClick} className="calc-key-fn py-2.5 rounded-xl text-xs font-semibold">
            {b.label}
          </button>
        ))}
      </div>

      {/* Standard Keypad */}
      <div className="grid grid-cols-4 gap-1.5">
        <button onClick={clear} className="calc-key-fn py-3.5 text-destructive font-bold rounded-2xl">
          AC
        </button>
        <button onClick={back} className="calc-key-fn py-3.5 rounded-2xl" aria-label="Backspace">
          <Delete className="h-5 w-5 mx-auto" />
        </button>
        <button onClick={() => append("%")} className="calc-key-fn py-3.5 font-bold rounded-2xl">
          %
        </button>
        <button onClick={() => append("/")} className="calc-key-op py-3.5 text-xl rounded-2xl">
          ÷
        </button>

        {[7, 8, 9].map((n) => (
          <button key={n} onClick={() => append(String(n))} className="calc-key-num py-3.5 text-xl rounded-2xl font-semibold">
            {n}
          </button>
        ))}
        <button onClick={() => append("*")} className="calc-key-op py-3.5 text-xl rounded-2xl">
          ×
        </button>

        {[4, 5, 6].map((n) => (
          <button key={n} onClick={() => append(String(n))} className="calc-key-num py-3.5 text-xl rounded-2xl font-semibold">
            {n}
          </button>
        ))}
        <button onClick={() => append("-")} className="calc-key-op py-3.5 text-xl rounded-2xl">
          −
        </button>

        {[1, 2, 3].map((n) => (
          <button key={n} onClick={() => append(String(n))} className="calc-key-num py-3.5 text-xl rounded-2xl font-semibold">
            {n}
          </button>
        ))}
        <button onClick={() => append("+")} className="calc-key-op py-3.5 text-xl rounded-2xl">
          +
        </button>

        <button
          onClick={() =>
            setExpr((e) => (e.startsWith("-") ? e.slice(1) : "-" + e))
          }
          className="calc-key-num py-3.5 text-xl rounded-2xl"
        >
          ±
        </button>
        <button onClick={() => append("0")} className="calc-key-num py-3.5 text-xl rounded-2xl font-semibold">
          0
        </button>
        <button onClick={() => append(".")} className="calc-key-num py-3.5 text-xl rounded-2xl">
          .
        </button>
        <button onClick={equals} className="calc-key-eq py-3.5 text-2xl font-bold rounded-2xl">
          =
        </button>
      </div>
    </div>
  );
};

export default Calculator;

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
  return String(r ?? "");
}
