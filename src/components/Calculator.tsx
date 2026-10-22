import React, { useState, useEffect, useCallback } from "react";
import { evaluate } from "mathjs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CameraScanModal } from "@/components/CameraScanModal";
import { VoiceInputButton } from "@/components/VoiceInputButton";
import { downloadCalculationPdf } from "@/lib/pdfReportGenerator";
import { copyToClipboard } from "@/lib/clipboard";
import {
  getTrialStatus,
  activateTrial,
  canUseFreeTrial,
  consumeFreeTrial,
  consumeDailyHistorySave,
  canSaveFreeHistory,
} from "@/lib/freemium";
import { formatWithCommas } from "@/lib/formatNumber";
import {
  Camera,
  Copy,
  Check,
  FileDown,
  History,
  Trash2,
  Delete,
  Sparkles,
  Lock,
} from "lucide-react";

interface CalculatorProps {
  isPro: boolean;
  onRequestUpgrade: (featureName: string) => void;
}

interface HistoryItem {
  id: string;
  expression: string;
  result: string;
  timestamp: number;
}

const STORAGE_CALC_HISTORY = "nume.calc-history.v1";
const STORAGE_CALC_MEMORY = "nume.calc-memory.v1";

export default function Calculator({ isPro, onRequestUpgrade }: CalculatorProps) {
  const [expression, setExpression] = useState("");
  const [result, setResult] = useState("0");
  const [lastAnswer, setLastAnswer] = useState("0");
  const [angleMode, setAngleMode] = useState<"DEG" | "RAD">("DEG");
  const [isSecond, setIsSecond] = useState(false);
  const [memory, setMemory] = useState<number>(0);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [cameraModalOpen, setCameraModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Free trial statuses
  const cameraTrial = getTrialStatus("camera");
  const voiceTrial = getTrialStatus("voice");
  const pdfTrial = getTrialStatus("pdf");
  const copyTrial = getTrialStatus("copy");
  const historyTrial = getTrialStatus("history");

  const anyTrialActive =
    cameraTrial.activated ||
    voiceTrial.activated ||
    pdfTrial.activated ||
    copyTrial.activated ||
    historyTrial.activated;

  const minHoursRemaining = Math.min(
    ...[cameraTrial, voiceTrial, pdfTrial, copyTrial, historyTrial]
      .filter((s) => s.activated)
      .map((s) => s.hoursRemaining)
  );

  // Load history and memory from local storage
  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem(STORAGE_CALC_HISTORY);
      if (savedHistory) setHistory(JSON.parse(savedHistory));

      const savedMemory = localStorage.getItem(STORAGE_CALC_MEMORY);
      if (savedMemory) setMemory(parseFloat(savedMemory) || 0);
    } catch {
      // ignore storage error
    }
  }, []);

  // Live evaluation preview as user types
  useEffect(() => {
    if (!expression.trim()) {
      setResult("0");
      return;
    }
    try {
      let exprToEval = expression
        .replace(/×/g, "*")
        .replace(/÷/g, "/")
        .replace(/−/g, "-")
        .replace(/π/g, "pi")
        .replace(/Ans/g, lastAnswer || "0");

      if (angleMode === "DEG") {
        exprToEval = exprToEval
          .replace(/sin\(([^)]+)\)/g, "sin(($1) * pi / 180)")
          .replace(/cos\(([^)]+)\)/g, "cos(($1) * pi / 180)")
          .replace(/tan\(([^)]+)\)/g, "tan(($1) * pi / 180)");
      }

      const evalResult = evaluate(exprToEval);
      if (typeof evalResult === "number" && !isNaN(evalResult) && isFinite(evalResult)) {
        const formatted = Number(evalResult.toFixed(8)).toString();
        setResult(formatted);
      }
    } catch {
      // Expression incomplete while typing
    }
  }, [expression, angleMode, lastAnswer]);

  const handleCalculate = useCallback(() => {
    if (!expression.trim()) return;
    try {
      let exprToEval = expression
        .replace(/×/g, "*")
        .replace(/÷/g, "/")
        .replace(/−/g, "-")
        .replace(/π/g, "pi")
        .replace(/Ans/g, lastAnswer || "0");

      if (angleMode === "DEG") {
        exprToEval = exprToEval
          .replace(/sin\(([^)]+)\)/g, "sin(($1) * pi / 180)")
          .replace(/cos\(([^)]+)\)/g, "cos(($1) * pi / 180)")
          .replace(/tan\(([^)]+)\)/g, "tan(($1) * pi / 180)");
      }

      const evalResult = evaluate(exprToEval);
      if (typeof evalResult === "number" && !isNaN(evalResult) && isFinite(evalResult)) {
        const formatted = Number(evalResult.toFixed(8)).toString();
        setResult(formatted);
        setLastAnswer(formatted);

        // Save to calculation history (1 trial only -> then locked to Premium Forever)
        const canSave = isPro || canSaveFreeHistory();
        if (canSave) {
          if (!isPro) consumeDailyHistorySave();
          const newItem: HistoryItem = {
            id: Date.now().toString(),
            expression,
            result: formatted,
            timestamp: Date.now(),
          };
          setHistory((prev) => {
            const next = [newItem, ...prev].slice(0, 30);
            try {
              localStorage.setItem(STORAGE_CALC_HISTORY, JSON.stringify(next));
            } catch {
              // ignore storage error
            }
            return next;
          });
        }
      } else {
        setResult("Error");
      }
    } catch {
      setResult("Error");
    }
  }, [expression, angleMode, lastAnswer, isPro]);

  const appendToExpression = useCallback((value: string) => {
    setExpression((prev) => prev + value);
  }, []);

  const handleClear = useCallback(() => {
    setExpression("");
    setResult("0");
  }, []);

  const handleBackspace = useCallback(() => {
    setExpression((prev) => prev.slice(0, -1));
  }, []);

  // Keyboard navigation support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;

      if (e.key >= "0" && e.key <= "9") {
        appendToExpression(e.key);
      } else if (e.key === "+" || e.key === "-" || e.key === "*" || e.key === "/") {
        const symbolMap: Record<string, string> = { "*": "×", "/": "÷", "-": "−", "+": "+" };
        appendToExpression(symbolMap[e.key] || e.key);
      } else if (e.key === "." || e.key === "(" || e.key === ")" || e.key === "^") {
        appendToExpression(e.key);
      } else if (e.key === "Enter" || e.key === "=") {
        e.preventDefault();
        handleCalculate();
      } else if (e.key === "Backspace") {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === "Escape") {
        e.preventDefault();
        handleClear();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [appendToExpression, handleCalculate, handleBackspace, handleClear]);

  // Memory functions
  const handleMemoryClear = () => {
    setMemory(0);
    localStorage.removeItem(STORAGE_CALC_MEMORY);
  };

  const handleMemoryRecall = () => {
    appendToExpression(memory.toString());
  };

  const handleMemoryAdd = () => {
    const currentVal = parseFloat(result) || 0;
    const next = memory + currentVal;
    setMemory(next);
    localStorage.setItem(STORAGE_CALC_MEMORY, next.toString());
  };

  const handleMemorySubtract = () => {
    const currentVal = parseFloat(result) || 0;
    const next = memory - currentVal;
    setMemory(next);
    localStorage.setItem(STORAGE_CALC_MEMORY, next.toString());
  };

  // 1 Trial Only -> Premium for Camera
  const handleScanClick = () => {
    if (!isPro && !canUseFreeTrial("camera")) {
      onRequestUpgrade("Camera OCR Math Scan (Premium)");
      return;
    }
    activateTrial("camera");
    setCameraModalOpen(true);
  };

  const handleScanSuccess = (text: string) => {
    if (!isPro) {
      consumeFreeTrial("camera");
    }
    appendToExpression(text);
  };

  // 1 Trial Only -> Premium for Voice
  const handleVoiceTranscript = (text: string) => {
    if (!isPro && !canUseFreeTrial("voice")) {
      onRequestUpgrade("Voice Math Dictation (Premium)");
      return;
    }
    activateTrial("voice");
    if (!isPro) {
      consumeFreeTrial("voice");
    }
    const cleaned = text
      .toLowerCase()
      .replace(/plus/g, "+")
      .replace(/minus/g, "−")
      .replace(/times|multiplied by/g, "×")
      .replace(/divided by|over/g, "÷")
      .replace(/squared/g, "^2")
      .replace(/cubed/g, "^3")
      .replace(/to the power of/g, "^")
      .replace(/open bracket|open parenthesis/g, "(")
      .replace(/close bracket|close parenthesis/g, ")");
    setExpression((prev) => (prev ? `${prev} ${cleaned}` : cleaned));
  };

  // 1 Trial Only -> Premium for Copy
  const handleCopyResult = async () => {
    if (!isPro && !canUseFreeTrial("copy")) {
      onRequestUpgrade("Answer Copying (Premium)");
      return;
    }
    activateTrial("copy");
    const success = await copyToClipboard(result);
    if (success) {
      if (!isPro) consumeFreeTrial("copy");
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  // 1 Trial Only -> Premium for PDF Download
  const handlePdfDownload = () => {
    if (!isPro && !canUseFreeTrial("pdf")) {
      onRequestUpgrade("PDF Export (Premium)");
      return;
    }
    activateTrial("pdf");
    if (!isPro) consumeFreeTrial("pdf");
    downloadCalculationPdf(expression || "0", result);
  };

  // History button click handler
  const handleHistoryClick = () => {
    if (!isPro && !canSaveFreeHistory() && history.length === 0) {
      onRequestUpgrade("Calculation History (Premium)");
      return;
    }
    setShowHistory((h) => !h);
  };

  return (
    <div className="space-y-3">
      {/* Main Calculator Display Card */}
      <Card className="rounded-3xl border border-border bg-card shadow-lg p-4 space-y-3">
        {/* Top Control Bar: Mode Toggles & Action Buttons */}
        <div className="flex items-center justify-between text-xs font-semibold">
          <div className="flex items-center gap-1.5 bg-muted p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setAngleMode("DEG")}
              className={`px-2 py-0.5 rounded-lg text-[11px] transition ${
                angleMode === "DEG"
                  ? "bg-card text-foreground font-bold shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              DEG
            </button>
            <button
              type="button"
              onClick={() => setAngleMode("RAD")}
              className={`px-2 py-0.5 rounded-lg text-[11px] transition ${
                angleMode === "RAD"
                  ? "bg-card text-foreground font-bold shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              RAD
            </button>
            {memory !== 0 && (
              <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-primary/10 text-primary">
                M
              </span>
            )}
          </div>

          {/* Quick Actions Bar with 1-Trial Indicators */}
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-2.5 text-xs font-semibold gap-1.5 rounded-xl border-border relative"
              onClick={handleScanClick}
              title={
                !isPro && !cameraTrial.canUse
                  ? "Camera Scan (Premium)"
                  : "Camera Math OCR"
              }
            >
              <Camera className="w-3.5 h-3.5 text-primary" />
              <span>Scan</span>
              {!isPro && !cameraTrial.canUse && (
                <Lock className="w-2.5 h-2.5 text-amber-500 ml-0.5" />
              )}
            </Button>

            <div className="relative">
              <VoiceInputButton onTranscript={handleVoiceTranscript} />
              {!isPro && !voiceTrial.canUse && (
                <Lock className="w-2.5 h-2.5 text-amber-500 absolute -top-1 -right-1" />
              )}
            </div>

            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-xl border-border relative"
              onClick={() => void handleCopyResult()}
              title={
                !isPro && !copyTrial.canUse
                  ? "Copy (Premium)"
                  : "Copy Answer"
              }
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-500" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              {!isPro && !copyTrial.canUse && (
                <Lock className="w-2.5 h-2.5 text-amber-500 absolute -top-1 -right-1" />
              )}
            </Button>

            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-xl border-border relative"
              onClick={handlePdfDownload}
              title={
                !isPro && !pdfTrial.canUse
                  ? "Export PDF (Premium)"
                  : "Export PDF"
              }
            >
              <FileDown className="w-3.5 h-3.5" />
              {!isPro && !pdfTrial.canUse && (
                <Lock className="w-2.5 h-2.5 text-amber-500 absolute -top-1 -right-1" />
              )}
            </Button>

            <Button
              variant={showHistory ? "default" : "outline"}
              size="icon"
              className="h-8 w-8 rounded-xl border-border relative"
              onClick={handleHistoryClick}
              title={
                !isPro && !historyTrial.canUse
                  ? "Calculation History (Premium)"
                  : "Calculation History"
              }
            >
              <History className="w-3.5 h-3.5" />
              {!isPro && !historyTrial.canUse && (
                <Lock className="w-2.5 h-2.5 text-amber-500 absolute -top-1 -right-1" />
              )}
            </Button>
          </div>
        </div>

        {/* Display Screen */}
        <div className="bg-muted/60 p-4 rounded-2xl border border-border/80 text-right space-y-1 overflow-hidden">
          <div className="text-xs text-muted-foreground font-mono truncate min-h-[18px]">
            {expression || "0"}
          </div>
          <div className="text-3xl font-extrabold tracking-tight font-mono truncate text-foreground">
            {formatWithCommas(result)}
          </div>
        </div>

        {/* Memory Row */}
        <div className="grid grid-cols-4 gap-1.5">
          <button
            type="button"
            onClick={handleMemoryClear}
            className="py-1 rounded-xl text-xs font-semibold text-muted-foreground hover:bg-muted transition"
          >
            MC
          </button>
          <button
            type="button"
            onClick={handleMemoryRecall}
            className="py-1 rounded-xl text-xs font-semibold text-muted-foreground hover:bg-muted transition"
          >
            MR
          </button>
          <button
            type="button"
            onClick={handleMemoryAdd}
            className="py-1 rounded-xl text-xs font-semibold text-muted-foreground hover:bg-muted transition"
          >
            M+
          </button>
          <button
            type="button"
            onClick={handleMemorySubtract}
            className="py-1 rounded-xl text-xs font-semibold text-muted-foreground hover:bg-muted transition"
          >
            M−
          </button>
        </div>

        {/* Scientific Function Grid */}
        <div className="grid grid-cols-5 gap-1.5">
          <Button
            variant={isSecond ? "default" : "secondary"}
            className="h-10 rounded-xl text-xs font-semibold"
            onClick={() => setIsSecond((s) => !s)}
          >
            2nd
          </Button>
          <Button
            variant="secondary"
            className="h-10 rounded-xl text-xs font-semibold"
            onClick={() => appendToExpression(isSecond ? "asin(" : "sin(")}
          >
            {isSecond ? "sin⁻¹" : "sin"}
          </Button>
          <Button
            variant="secondary"
            className="h-10 rounded-xl text-xs font-semibold"
            onClick={() => appendToExpression(isSecond ? "acos(" : "cos(")}
          >
            {isSecond ? "cos⁻¹" : "cos"}
          </Button>
          <Button
            variant="secondary"
            className="h-10 rounded-xl text-xs font-semibold"
            onClick={() => appendToExpression(isSecond ? "atan(" : "tan(")}
          >
            {isSecond ? "tan⁻¹" : "tan"}
          </Button>
          <Button
            variant="secondary"
            className="h-10 rounded-xl text-xs font-semibold"
            onClick={() => appendToExpression("π")}
          >
            π
          </Button>

          {/* Row 2 */}
          <Button
            variant="secondary"
            className="h-10 rounded-xl text-xs font-semibold"
            onClick={() => appendToExpression(isSecond ? "10^(" : "log(")}
          >
            {isSecond ? "10ˣ" : "log"}
          </Button>
          <Button
            variant="secondary"
            className="h-10 rounded-xl text-xs font-semibold"
            onClick={() => appendToExpression(isSecond ? "e^(" : "ln(")}
          >
            {isSecond ? "eˣ" : "ln"}
          </Button>
          <Button
            variant="secondary"
            className="h-10 rounded-xl text-xs font-semibold"
            onClick={() => appendToExpression("^")}
          >
            xʸ
          </Button>
          <Button
            variant="secondary"
            className="h-10 rounded-xl text-xs font-semibold"
            onClick={() => appendToExpression(isSecond ? "^2" : "sqrt(")}
          >
            {isSecond ? "x²" : "√"}
          </Button>
          <Button
            variant="secondary"
            className="h-10 rounded-xl text-xs font-semibold"
            onClick={() => appendToExpression("e")}
          >
            e
          </Button>

          {/* Row 3 */}
          <Button
            variant="secondary"
            className="h-10 rounded-xl text-xs font-semibold"
            onClick={() => appendToExpression("(")}
          >
            (
          </Button>
          <Button
            variant="secondary"
            className="h-10 rounded-xl text-xs font-semibold"
            onClick={() => appendToExpression(")")}
          >
            )
          </Button>
          <Button
            variant="secondary"
            className="h-10 rounded-xl text-xs font-semibold"
            onClick={() => appendToExpression("%")}
          >
            %
          </Button>
          <Button
            variant="outline"
            className="h-10 rounded-xl text-xs font-semibold text-red-500 hover:text-red-600 hover:bg-red-500/10"
            onClick={handleClear}
          >
            AC
          </Button>
          <Button
            variant="outline"
            className="h-10 rounded-xl text-xs font-semibold"
            onClick={handleBackspace}
          >
            <Delete className="w-4 h-4" />
          </Button>

          {/* Row 4: Numbers 7, 8, 9, ÷ */}
          <Button
            variant="outline"
            className="h-11 rounded-2xl text-base font-semibold"
            onClick={() => appendToExpression("7")}
          >
            7
          </Button>
          <Button
            variant="outline"
            className="h-11 rounded-2xl text-base font-semibold"
            onClick={() => appendToExpression("8")}
          >
            8
          </Button>
          <Button
            variant="outline"
            className="h-11 rounded-2xl text-base font-semibold"
            onClick={() => appendToExpression("9")}
          >
            9
          </Button>
          <Button
            variant="secondary"
            className="h-11 rounded-2xl text-base font-bold text-primary"
            onClick={() => appendToExpression("÷")}
          >
            ÷
          </Button>
          <Button
            variant="secondary"
            className="h-11 rounded-2xl text-xs font-semibold"
            onClick={() => appendToExpression("Ans")}
          >
            Ans
          </Button>

          {/* Row 5: Numbers 4, 5, 6, × */}
          <Button
            variant="outline"
            className="h-11 rounded-2xl text-base font-semibold"
            onClick={() => appendToExpression("4")}
          >
            4
          </Button>
          <Button
            variant="outline"
            className="h-11 rounded-2xl text-base font-semibold"
            onClick={() => appendToExpression("5")}
          >
            5
          </Button>
          <Button
            variant="outline"
            className="h-11 rounded-2xl text-base font-semibold"
            onClick={() => appendToExpression("6")}
          >
            6
          </Button>
          <Button
            variant="secondary"
            className="h-11 rounded-2xl text-base font-bold text-primary"
            onClick={() => appendToExpression("×")}
          >
            ×
          </Button>
          <Button
            variant="secondary"
            className="h-11 rounded-2xl text-xs font-semibold"
            onClick={() => appendToExpression("!")}
          >
            x!
          </Button>

          {/* Row 6: Numbers 1, 2, 3, − */}
          <Button
            variant="outline"
            className="h-11 rounded-2xl text-base font-semibold"
            onClick={() => appendToExpression("1")}
          >
            1
          </Button>
          <Button
            variant="outline"
            className="h-11 rounded-2xl text-base font-semibold"
            onClick={() => appendToExpression("2")}
          >
            2
          </Button>
          <Button
            variant="outline"
            className="h-11 rounded-2xl text-base font-semibold"
            onClick={() => appendToExpression("3")}
          >
            3
          </Button>
          <Button
            variant="secondary"
            className="h-11 rounded-2xl text-base font-bold text-primary"
            onClick={() => appendToExpression("−")}
          >
            −
          </Button>
          <Button
            variant="secondary"
            className="h-11 rounded-2xl text-xs font-semibold"
            onClick={() => appendToExpression("^(-1)")}
          >
            1/x
          </Button>

          {/* Row 7: 0, ., =, + */}
          <Button
            variant="outline"
            className="h-11 rounded-2xl text-base font-semibold"
            onClick={() => appendToExpression("0")}
          >
            0
          </Button>
          <Button
            variant="outline"
            className="h-11 rounded-2xl text-base font-bold"
            onClick={() => appendToExpression(".")}
          >
            .
          </Button>
          <Button
            className="col-span-2 h-11 rounded-2xl text-lg font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
            onClick={handleCalculate}
          >
            =
          </Button>
          <Button
            variant="secondary"
            className="h-11 rounded-2xl text-base font-bold text-primary"
            onClick={() => appendToExpression("+")}
          >
            +
          </Button>
        </div>
      </Card>

      {/* History Panel */}
      {showHistory && (
        <Card className="rounded-3xl border border-border bg-card p-4 space-y-3 shadow-md">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <History className="w-3.5 h-3.5 text-primary" />
              Calculation History
              {!isPro && !historyTrial.canUse && (
                <span className="text-[10px] text-amber-500 font-semibold">
                  🔒 Premium
                </span>
              )}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-red-500 transition flex items-center gap-1"
                onClick={() => {
                  setHistory([]);
                  localStorage.removeItem(STORAGE_CALC_HISTORY);
                }}
              >
                <Trash2 className="w-3 h-3" />
                Clear
              </button>
            </div>
          </div>

          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {history.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-4">
                No saved calculations yet.
              </p>
            ) : (
              history.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-muted/60 border border-border text-xs cursor-pointer hover:bg-muted transition"
                  onClick={() => {
                    setExpression(item.expression);
                    setResult(item.result);
                  }}
                >
                  <span className="font-mono text-foreground/80 truncate mr-2">
                    {item.expression}
                  </span>
                  <span className="font-mono font-bold text-primary shrink-0">
                    = {formatWithCommas(item.result)}
                  </span>
                </div>
              ))
            )}
          </div>
        </Card>
      )}

      {/* Camera OCR Modal */}
      <CameraScanModal
        open={cameraModalOpen}
        onOpenChange={setCameraModalOpen}
        onScanResult={handleScanSuccess}
      />
    </div>
  );
}
