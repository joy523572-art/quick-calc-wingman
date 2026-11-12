import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { solveEquation } from "@/lib/equationSolver";
import { solveEquationWithAiFallback, EquationAiResult } from "@/lib/aiFallbackSystem";
import { canAccessPremiumFeature } from "@/lib/freemium";
import { consumeFeatureTrial, formatTrialTimeRemaining } from "@/lib/trialManager";
import { downloadTextPdf } from "@/lib/historyExport";
import { PremiumLock } from "@/components/PremiumLock";
import { Lock, AlertCircle, CheckCircle2, FileDown, Loader2, Calculator, Copy, Check, Sparkles } from "lucide-react";
import { copyToClipboard } from "@/lib/clipboard";
import { toast } from "@/hooks/use-toast";

interface EquationSolverViewProps {
  isPro: boolean;
  onRequestUpgrade: (featureName: string) => void;
}

export const EquationSolverView: React.FC<EquationSolverViewProps> = ({ isPro, onRequestUpgrade }) => {
  const [inputEq, setInputEq] = useState("");
  const [solution, setSolution] = useState<EquationAiResult | null>(null);
  const [solvedEq, setSolvedEq] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSolving, setIsSolving] = useState(false);

  const resultRef = useRef<HTMLDivElement>(null);

  const locked = !canAccessPremiumFeature("equation", isPro);

  const handleSolve = async (overrideEq?: string) => {
    if (locked) return onRequestUpgrade("Equation Solver");

    const target = (overrideEq !== undefined ? overrideEq : inputEq).trim();
    if (!target) {
      setErrorMsg("Please enter an equation");
      setSolution(null);
      return;
    }

    if (!isPro) {
      consumeFeatureTrial("equation");
    }

    setIsSolving(true);
    try {
      const res = await solveEquationWithAiFallback(target);
      setErrorMsg(null);
      setSolution(res);
      setSolvedEq(target);

      // Only scroll if solution is below viewport fold
      setTimeout(() => {
        if (resultRef.current) {
          const rect = resultRef.current.getBoundingClientRect();
          if (rect.bottom > window.innerHeight) {
            resultRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
          }
        }
      }, 60);
    } catch {
      // Zero-error safety net: always fall back to local deterministic engine
      try {
        const localRes = solveEquation(target);
        setErrorMsg(null);
        setSolution({
          ...localRes,
          providerUsed: "Local Deterministic Engine",
        });
        setSolvedEq(target);
      } catch (err: unknown) {
        setErrorMsg((err as Error)?.message || "Check syntax.");
        setSolution(null);
      }
    } finally {
      setIsSolving(false);
    }
  };

  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!solution) return;
    const ok = await copyToClipboard(solution.summary);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "Answer copied",
        description: `"${solution.summary}" copied to clipboard.`,
      });
    }
  };

  const downloadPdf = () => {
    if (!canAccessPremiumFeature("equation_pdf", isPro)) return onRequestUpgrade("Download Answers as PDF");
    if (!solution) return;
    downloadTextPdf(
      "Nume - Equation Solution",
      [`Equation: ${solvedEq}`, `Answer: ${solution.summary}`, "", "Step-by-step:", ...solution.steps.map((s, i) => `${i + 1}. ${s}`)],
      "nume-equation-solution.pdf",
    );
  };

  return (
    <Card className="rounded-3xl border border-border bg-card shadow-lg p-4 space-y-4">

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSolve();
        }}
        className="space-y-4"
      >
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
            <Calculator className="w-3.5 h-3.5 text-primary" />
            <span>Enter algebraic equation</span>
          </label>
          <span className="text-[11px] font-semibold text-muted-foreground">
            {isPro ? "Unlimited Pro" : formatTrialTimeRemaining("equation")}
          </span>
        </div>

        <div className="space-y-1.5">
          <Textarea
            aria-label="Equation"
            value={inputEq}
            maxLength={4000}
            disabled={locked}
            onChange={(e) => {
              setInputEq(e.target.value);
              if (errorMsg) setErrorMsg(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSolve();
              }
            }}
            placeholder="e.g. 2x + 5 = 15"
            className="min-h-[120px] w-full p-3.5 rounded-2xl text-sm font-mono resize-y bg-muted/30 focus:bg-background border-border/80 transition"
          />
          <div className="flex justify-between items-center text-[11px] text-muted-foreground px-1">
            <span>Press Enter or tap Solve Equation</span>
            <span>{inputEq.length} / 4000</span>
          </div>
        </div>

        {/* Action button: Solve Equation */}
        <div className="pt-1">
          <Button
            type="submit"
            disabled={isSolving}
            style={{ touchAction: "manipulation" }}
            className="w-full h-12 min-h-[48px] rounded-xl font-bold gap-2 text-sm bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm active:scale-95 transition-all cursor-pointer select-none"
          >
            {isSolving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Solving…</span>
              </>
            ) : locked ? (
              <>
                <Lock className="w-4 h-4" /> Premium
              </>
            ) : (
              <>
                <Calculator className="w-4 h-4" />
                <span>Solve Equation</span>
              </>
            )}
          </Button>
        </div>
      </form>

      {/* Result scroll anchor */}
      <div ref={resultRef} className="space-y-4">
        {errorMsg && (
          <div className="p-3.5 rounded-2xl bg-destructive/10 border border-destructive/20 text-xs text-destructive flex items-center gap-2 font-medium">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Solutions Display Container - Rendered whenever solution exists */}
        {solution && (
          <div className="p-4 rounded-2xl bg-muted/40 border border-border/80 space-y-3 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-primary" /> Solution
                </span>
                {solution.providerUsed && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> {solution.providerUsed}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <Button
                  size="sm"
                  type="button"
                  variant="outline"
                  onClick={handleCopy}
                  className={`h-7 px-2.5 text-xs gap-1.5 rounded-lg font-medium transition cursor-pointer ${
                    copied ? "border-emerald-500/50 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30" : ""
                  }`}
                  title="Copy answer at once"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? "Copied!" : "Copy"}</span>
                </Button>
                <Button
                  size="sm"
                  type="button"
                  variant="outline"
                  onClick={downloadPdf}
                  className="h-7 px-2.5 text-xs gap-1.5 rounded-lg font-medium cursor-pointer"
                  title="Download working as PDF"
                >
                  <FileDown className="w-3.5 h-3.5" /> PDF
                </Button>
              </div>
            </div>

            {/* Main Answer Display with click-to-copy */}
            <div
              onClick={handleCopy}
              title="Click or tap to copy answer at once"
              className="group p-2.5 -mx-1 rounded-xl hover:bg-muted/70 active:bg-muted transition cursor-pointer flex items-center justify-between gap-3 border border-transparent hover:border-border/60"
            >
              <div className="text-xl font-extrabold font-mono text-foreground break-all">
                {solution.summary}
              </div>
              <div className="shrink-0 flex items-center gap-1 text-[11px] font-medium text-muted-foreground group-hover:text-primary transition">
                {copied ? (
                  <span className="text-emerald-500 flex items-center gap-1 font-bold">
                    <Check className="w-3 h-3" /> Copied!
                  </span>
                ) : (
                  <span className="flex items-center gap-1 opacity-70 group-hover:opacity-100">
                    <Copy className="w-3 h-3" /> Copy
                  </span>
                )}
              </div>
            </div>

            {/* Educational Formula Note or Definition if available */}
            {solution.formulaNote && (
              <div className="p-2.5 rounded-xl bg-primary/5 border border-primary/10 text-xs text-foreground/80 leading-relaxed font-sans">
                <span className="font-semibold text-primary">Formula Note: </span>
                {solution.formulaNote}
              </div>
            )}
            {solution.definition && (
              <div className="p-2.5 rounded-xl bg-muted/60 border border-border/60 text-xs text-muted-foreground leading-relaxed font-sans">
                <span className="font-semibold text-foreground">Standard Theory: </span>
                {solution.definition}
              </div>
            )}
            <div className="pt-2 border-t border-border/60 space-y-2">
              <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Step-by-step working</div>
              {solution.steps.map((st, idx) => (
                <div key={idx} className="text-xs text-foreground/90 flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <span className="leading-relaxed font-mono">{st}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {locked && (
        <div className="p-3.5 rounded-2xl bg-primary/10 border border-primary/20 text-xs flex items-center justify-between gap-2">
          <span className="flex items-center gap-2"><PremiumLock /> Equation Solver requires Premium.</span>
          <Button size="sm" onClick={() => onRequestUpgrade("Equation Solver")} className="h-8 text-xs rounded-xl font-bold">
            Get Unlimited Access
          </Button>
        </div>
      )}
    </Card>
  );
};
