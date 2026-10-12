import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { solveEquation, type EquationSolution } from "@/lib/equationSolver";
import { canUseFreeTrial, consumeFreeTrial, FREE_LIMITS } from "@/lib/freemium";
import { Sparkles, ArrowRight, Lock, CheckCircle2, AlertCircle } from "lucide-react";

interface EquationSolverViewProps {
  isPro: boolean;
  onRequestUpgrade: (feature: string) => void;
}

const PRESET_EQUATIONS = [
  "2x + 5 = 15",
  "x² - 5x + 6 = 0",
  "3x - 9 = 0",
  "x² - 16 = 0",
  "2x² + 4x - 6 = 0",
];

export const EquationSolverView: React.FC<EquationSolverViewProps> = ({
  isPro,
  onRequestUpgrade,
}) => {
  const [equation, setEquation] = useState("2x + 5 = 15");
  const [solution, setSolution] = useState<EquationSolution | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasTrial = canUseFreeTrial("equation");

  const handleSolve = (eqToSolve?: string) => {
    const input = eqToSolve ?? equation;
    if (!input.trim()) return;

    if (!isPro && !hasTrial) {
      onRequestUpgrade("Equation Solver");
      return;
    }

    try {
      setError(null);
      const res = solveEquation(input);
      if (!isPro) {
        consumeFreeTrial("equation");
      }
      setSolution(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not solve equation.");
      setSolution(null);
    }
  };

  const insertSymbol = (char: string) => {
    setEquation((prev) => prev + char);
  };

  return (
    <div className="w-full max-w-md mx-auto space-y-4">
      <Card className="border-border bg-card shadow-lg rounded-2xl">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              Equation Solver
              {!isPro && (
                <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-primary/10 text-primary flex items-center gap-1">
                  {hasTrial ? `${FREE_LIMITS.equation} Free Trial` : <Lock className="w-3 h-3" />}
                </span>
              )}
            </CardTitle>
            {isPro && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                PRO Active
              </span>
            )}
          </div>
          <CardDescription className="text-xs text-muted-foreground">
            Solve linear and quadratic equations with full step-by-step mathematical working.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Enter Equation:</label>
            <div className="flex gap-2">
              <Input
                value={equation}
                onChange={(e) => setEquation(e.target.value)}
                placeholder="e.g. 2x + 5 = 15 or x² - 5x + 6 = 0"
                className="font-mono text-sm h-11"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSolve();
                }}
              />
              <Button
                onClick={() => handleSolve()}
                className="h-11 px-4 bg-primary text-primary-foreground font-semibold"
              >
                Solve
              </Button>
            </div>

            {/* Quick keys */}
            <div className="flex items-center gap-1 pt-1 overflow-x-auto no-scrollbar">
              {["x", "²", "+", "-", "=", "(", ")"].map((symbol) => (
                <button
                  key={symbol}
                  type="button"
                  onClick={() => insertSymbol(symbol)}
                  className="px-3 py-1 text-xs font-semibold rounded-md bg-muted hover:bg-secondary text-foreground transition"
                >
                  {symbol}
                </button>
              ))}
            </div>
          </div>

          {/* Quick presets */}
          <div className="space-y-1.5 pt-1">
            <div className="text-[11px] font-medium text-muted-foreground">Example Equations:</div>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_EQUATIONS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    setEquation(preset);
                    handleSolve(preset);
                  }}
                  className="px-2.5 py-1 text-xs rounded-lg border border-border bg-background hover:bg-muted font-mono text-muted-foreground hover:text-foreground transition"
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {!isPro && !hasTrial && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                <Lock className="w-4 h-4 shrink-0" />
                <span>Free trial used. Upgrade to PRO for unlimited solver.</span>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs border-amber-500/30 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20"
                onClick={() => onRequestUpgrade("Equation Solver")}
              >
                Upgrade
              </Button>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {solution && (
            <div className="space-y-3 pt-2 border-t border-border">
              <div className="p-3 rounded-xl bg-primary/10 border border-primary/20">
                <div className="text-xs font-semibold text-primary mb-1">Result Summary</div>
                <div className="text-base font-bold font-mono text-foreground">
                  {solution.summary}
                </div>
                {solution.roots.length > 0 && (
                  <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                    <span>Roots: {solution.roots.join(", ")}</span>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  Step-by-Step Solution:
                </div>
                <div className="space-y-1 bg-muted/50 p-3 rounded-xl border border-border text-xs font-mono">
                  {solution.steps.map((step, idx) => (
                    <div key={idx} className="leading-relaxed text-foreground/90">
                      {step}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
