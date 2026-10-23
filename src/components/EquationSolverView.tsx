import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { solveEquation, EquationSolution } from "@/lib/equationSolver";
import { canUseFreeTrial, consumeFreeTrial } from "@/lib/freemium";
import { Lock, Sparkles, AlertCircle, CheckCircle2 } from "lucide-react";

interface EquationSolverViewProps {
  isPro: boolean;
  onRequestUpgrade: (featureName: string) => void;
}

export const EquationSolverView: React.FC<EquationSolverViewProps> = ({
  isPro,
  onRequestUpgrade,
}) => {
  // Starts empty so counter starts at 0 / 4000
  const [inputEq, setInputEq] = useState<string>("");
  const [solution, setSolution] = useState<EquationSolution | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Free tier: 1 equation lifetime
  const isLocked = !isPro && !canUseFreeTrial("equation");

  const handleSolve = () => {
    if (isLocked) {
      onRequestUpgrade("Equation Solver");
      return;
    }

    if (!inputEq.trim()) {
      setErrorMsg("Please enter an equation, e.g. 2x + 5 = 15 or x² - 5x + 6 = 0");
      return;
    }

    try {
      setErrorMsg(null);
      const res = solveEquation(inputEq);
      setSolution(res);

      if (!isPro) {
        consumeFreeTrial("equation");
      }
    } catch (err: unknown) {
      setErrorMsg((err as Error)?.message || "Unable to solve equation. Check syntax (e.g. 2x + 5 = 15).");
      setSolution(null);
    }
  };

  const sampleEquations = [
    "2x + 5 = 15",
    "x² - 5x + 6 = 0",
    "3x - 9 = 0",
    "2x² + 4x - 6 = 0",
  ];

  return (
    <Card className="rounded-3xl border border-border bg-card shadow-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-muted-foreground">
            Enter Equation (Characters input, 4000)
          </label>
          {isLocked && (
            <span className="text-[10px] text-amber-500 font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 flex items-center gap-1">
              <Lock className="w-2.5 h-2.5" /> Trial used
            </span>
          )}
        </div>
        <div className="text-[11px] text-muted-foreground">
          {isPro ? "Unlimited Pro Mode" : "1 Lifetime Free Solve"}
        </div>
      </div>

      {/* Widened Text Input Box (up to 4000 chars) */}
      <div className="space-y-1.5">
        <Textarea
          value={inputEq}
          maxLength={4000}
          disabled={isLocked}
          onChange={(e) => {
            setInputEq(e.target.value);
            if (errorMsg) setErrorMsg(null);
          }}
          placeholder="Type or paste any algebraic equation up to 4000 characters (e.g. 2x + 5 = 15 or x² - 5x + 6 = 0)..."
          className="min-h-[110px] w-full p-3 rounded-2xl text-sm font-mono leading-relaxed resize-y border-border bg-muted/30 focus-visible:ring-primary/40 disabled:opacity-50"
        />
        <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1">
          <span>{isLocked ? "Trial used" : "Free tier: 1 equation lifetime"}</span>
          <span className={inputEq.length >= 3900 ? "text-amber-500 font-bold" : ""}>
            {inputEq.length} / 4000
          </span>
        </div>
      </div>

      {/* Sample Quick Taps */}
      {!isLocked && (
        <div className="flex flex-wrap gap-1.5">
          {sampleEquations.map((sample) => (
            <button
              key={sample}
              type="button"
              onClick={() => setInputEq(sample)}
              className="px-2.5 py-1 rounded-lg text-xs font-mono bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground transition border border-border/50"
            >
              {sample}
            </button>
          ))}
        </div>
      )}

      {/* Solve Button */}
      <Button
        onClick={handleSolve}
        className={`w-full h-11 rounded-xl font-bold gap-2 ${
          isLocked
            ? "bg-amber-500 hover:bg-amber-600 text-white"
            : "bg-primary text-primary-foreground hover:bg-primary/90"
        }`}
      >
        {isLocked ? (
          <>
            <Lock className="w-4 h-4" />
            Premium
          </>
        ) : (
          "Solve Equation"
        )}
      </Button>

      {/* Error notification */}
      {errorMsg && (
        <div className="p-3 rounded-2xl bg-destructive/10 border border-destructive/20 text-xs text-destructive flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Solution Display Card */}
      {solution && (
        <div className="p-4 rounded-2xl bg-muted/50 border border-border space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">
              Solution
            </span>
            <span className="text-xs font-bold text-primary flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-primary" /> Verified
            </span>
          </div>
          <div className="text-xl font-extrabold text-foreground font-mono">
            {solution.summary}
          </div>

          <div className="pt-2 border-t border-border/60 space-y-1.5">
            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Step-by-Step Working:
            </div>
            {solution.steps.map((st, idx) => (
              <div key={idx} className="text-xs text-foreground/80 flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                  {idx + 1}
                </span>
                <span className="leading-relaxed">{st}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {isLocked && !solution && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-500 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 shrink-0" />
            <span>You have solved your 1 free lifetime equation.</span>
          </div>
          <Button
            size="sm"
            onClick={() => onRequestUpgrade("Equation Solver")}
            className="h-7 text-xs bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-bold"
          >
            Unlock Unlimited
          </Button>
        </div>
      )}
    </Card>
  );
};
