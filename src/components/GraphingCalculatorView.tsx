import React, { useState, useMemo } from "react";
import { evaluate } from "mathjs";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { canUseFreeTrial, consumeFreeTrial } from "@/lib/freemium";
import { Lock, Sparkles, AlertCircle } from "lucide-react";

interface GraphingCalculatorViewProps {
  isPro: boolean;
  onRequestUpgrade: (featureName: string) => void;
}

export const GraphingCalculatorView: React.FC<GraphingCalculatorViewProps> = ({
  isPro,
  onRequestUpgrade,
}) => {
  const [expr, setExpr] = useState<string>("x^2 - 4");
  const [activeFn, setActiveFn] = useState<string>("x^2 - 4");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Freemium limit: 1 free trial for free tier
  const isLocked = !isPro && !canUseFreeTrial("graph");

  const handlePlot = () => {
    if (isLocked) {
      onRequestUpgrade("Graphing Calculator");
      return;
    }

    if (!isPro) {
      consumeFreeTrial("graph");
    }

    setErrorMsg(null);
    setActiveFn(expr);
  };

  const data = useMemo(() => {
    const points: Array<{ x: number; y: number }> = [];
    const normalized = activeFn
      .replace(/×/g, "*")
      .replace(/÷/g, "/")
      .replace(/−/g, "-")
      .replace(/(\d)(x)/gi, "$1*$2");

    for (let x = -10; x <= 10; x += 0.5) {
      try {
        const roundedX = Number(x.toFixed(1));
        const val = evaluate(normalized, { x: roundedX, pi: Math.PI, e: Math.E });
        if (typeof val === "number" && isFinite(val) && !isNaN(val)) {
          // Clamp extreme values for readable plotting
          if (Math.abs(val) <= 200) {
            points.push({ x: roundedX, y: Number(val.toFixed(2)) });
          }
        }
      } catch {
        // Skip points outside domain
      }
    }
    return points;
  }, [activeFn]);

  const presets = ["x^2 - 4", "sin(x)", "cos(x)", "x^3 - 3*x", "2*x + 1"];

  return (
    <Card className="rounded-3xl border border-border bg-card shadow-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-muted-foreground">
            Function f(x)
          </label>
          {isLocked && (
            <span className="text-[10px] text-amber-500 font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 flex items-center gap-1">
              <Lock className="w-2.5 h-2.5" /> Trial used
            </span>
          )}
        </div>
        <div className="text-[11px] text-muted-foreground">
          {isPro ? "Unlimited Pro Mode" : "1 Free Graph Plot"}
        </div>
      </div>

      {/* Input row */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <span className="absolute left-3 top-2.5 text-xs font-mono text-muted-foreground">
            f(x) =
          </span>
          <Input
            value={expr}
            onChange={(e) => setExpr(e.target.value)}
            disabled={isLocked}
            placeholder="e.g. x^2 - 4"
            className="pl-14 h-11 rounded-xl text-sm font-mono"
          />
        </div>
        <Button
          onClick={handlePlot}
          className={`h-11 px-5 rounded-xl font-bold gap-1.5 ${
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
            "Plot"
          )}
        </Button>
      </div>

      {/* Preset Pills */}
      <div className="flex flex-wrap gap-1.5">
        {presets.map((p) => (
          <button
            key={p}
            type="button"
            disabled={isLocked}
            onClick={() => {
              setExpr(p);
              if (!isLocked) {
                if (!isPro) consumeFreeTrial("graph");
                setActiveFn(p);
              }
            }}
            className="px-2.5 py-1 rounded-lg text-xs font-mono bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground transition border border-border/50 disabled:opacity-50"
          >
            {p}
          </button>
        ))}
      </div>

      {/* Plot Canvas */}
      <div className="w-full h-64 bg-muted/30 rounded-2xl border border-border p-2 pt-4">
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
              <XAxis dataKey="x" stroke="#888888" fontSize={10} tickLine={false} />
              <YAxis stroke="#888888" fontSize={10} tickLine={false} domain={["auto", "auto"]} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(20, 20, 25, 0.9)",
                  borderRadius: "12px",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  fontSize: "12px",
                }}
              />
              <Line
                type="monotone"
                dataKey="y"
                stroke="#7c3aed"
                strokeWidth={2.5}
                dot={false}
                name="y = f(x)"
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-xs text-muted-foreground gap-2">
            <AlertCircle className="w-5 h-5 text-muted-foreground" />
            <span>Unable to plot function. Check mathematical expression.</span>
          </div>
        )}
      </div>

      {isLocked && (
        <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-amber-500">
            <Lock className="w-4 h-4 shrink-0" />
            <span>You have used your 1 free graph plot.</span>
          </div>
          <Button
            size="sm"
            onClick={() => onRequestUpgrade("2D Graphing")}
            className="h-7 text-xs bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-bold"
          >
            Unlock Unlimited
          </Button>
        </div>
      )}
    </Card>
  );
};
