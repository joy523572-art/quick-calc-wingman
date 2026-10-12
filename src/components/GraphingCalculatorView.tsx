import React, { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { compile, type EvalFunction } from "mathjs";
import { canUseFreeTrial, consumeFreeTrial, FREE_LIMITS } from "@/lib/freemium";
import { ZoomIn, ZoomOut, RotateCcw, Lock, Sparkles, AlertCircle } from "lucide-react";

interface GraphingCalculatorViewProps {
  isPro: boolean;
  onRequestUpgrade: (feature: string) => void;
}

const PRESET_FUNCTIONS = [
  { label: "sin(x)", expr: "sin(x)" },
  { label: "x² - 4", expr: "x^2 - 4" },
  { label: "cos(x)", expr: "cos(x)" },
  { label: "x³ - 3x", expr: "x^3 - 3*x" },
  { label: "√x", expr: "sqrt(x)" },
  { label: "1/x", expr: "1/x" },
];

export const GraphingCalculatorView: React.FC<GraphingCalculatorViewProps> = ({
  isPro,
  onRequestUpgrade,
}) => {
  const [expr, setExpr] = useState("sin(x)");
  const [range, setRange] = useState({ xMin: -10, xMax: 10, yMin: -6, yMax: 6 });
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const hasTrial = canUseFreeTrial("graph");

  const normalizeExpression = (raw: string) => {
    return raw
      .replace(/²/g, "^2")
      .replace(/³/g, "^3")
      .replace(/π/g, "pi")
      .replace(/×/g, "*")
      .replace(/÷/g, "/")
      .replace(/−/g, "-");
  };

  const drawGraph = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear
    ctx.clearRect(0, 0, width, height);

    const { xMin, xMax, yMin, yMax } = range;
    const toCanvasX = (x: number) => ((x - xMin) / (xMax - xMin)) * width;
    const toCanvasY = (y: number) => height - ((y - yMin) / (yMax - yMin)) * height;

    const isDarkMode = document.documentElement.classList.contains("dark");
    const gridColor = isDarkMode ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.08)";
    const axisColor = isDarkMode ? "rgba(255, 255, 255, 0.4)" : "rgba(0, 0, 0, 0.4)";
    const textColor = isDarkMode ? "rgba(255, 255, 255, 0.5)" : "rgba(0, 0, 0, 0.5)";
    const curveColor = "#8b5cf6"; // vibrant violet

    // Draw Grid Lines
    ctx.lineWidth = 1;
    ctx.strokeStyle = gridColor;
    ctx.beginPath();

    const xStep = Math.max(1, Math.round((xMax - xMin) / 10));
    for (let x = Math.ceil(xMin / xStep) * xStep; x <= xMax; x += xStep) {
      const cx = toCanvasX(x);
      ctx.moveTo(cx, 0);
      ctx.lineTo(cx, height);
    }

    const yStep = Math.max(1, Math.round((yMax - yMin) / 8));
    for (let y = Math.ceil(yMin / yStep) * yStep; y <= yMax; y += yStep) {
      const cy = toCanvasY(y);
      ctx.moveTo(0, cy);
      ctx.lineTo(width, cy);
    }
    ctx.stroke();

    // Draw Axes
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = axisColor;
    ctx.beginPath();

    // X Axis
    if (yMin <= 0 && yMax >= 0) {
      const cy0 = toCanvasY(0);
      ctx.moveTo(0, cy0);
      ctx.lineTo(width, cy0);
    }

    // Y Axis
    if (xMin <= 0 && xMax >= 0) {
      const cx0 = toCanvasX(0);
      ctx.moveTo(cx0, 0);
      ctx.lineTo(cx0, height);
    }
    ctx.stroke();

    // Axis Labels
    ctx.fillStyle = textColor;
    ctx.font = "10px sans-serif";
    ctx.textAlign = "center";
    for (let x = Math.ceil(xMin / xStep) * xStep; x <= xMax; x += xStep) {
      if (x === 0) continue;
      const cx = toCanvasX(x);
      const cy0 = Math.min(Math.max(toCanvasY(0) + 12, 12), height - 4);
      ctx.fillText(x.toString(), cx, cy0);
    }
    ctx.textAlign = "right";
    for (let y = Math.ceil(yMin / yStep) * yStep; y <= yMax; y += yStep) {
      if (y === 0) continue;
      const cy = toCanvasY(y);
      const cx0 = Math.min(Math.max(toCanvasX(0) - 4, 20), width - 4);
      ctx.fillText(y.toString(), cx0, cy + 3);
    }

    // Evaluate & Draw Function Curve
    const normalized = normalizeExpression(expr);
    let code: EvalFunction | null = null;
    try {
      code = compile(normalized);
      code.evaluate({ x: 1 });
      if (error) setError(null);
    } catch {
      setError("Invalid function expression");
      return;
    }

    ctx.lineWidth = 2.5;
    ctx.strokeStyle = curveColor;
    ctx.beginPath();

    let isDrawing = false;
    const stepPixels = 1;
    const totalSteps = width / stepPixels;

    for (let i = 0; i <= totalSteps; i++) {
      const px = i * stepPixels;
      const xVal = xMin + (px / width) * (xMax - xMin);

      let yVal = NaN;
      try {
        const val = code.evaluate({ x: xVal });
        if (typeof val === "number" && isFinite(val)) {
          yVal = val;
        } else if (val && typeof val === "object" && "re" in val) {
          const comp = val as { re: number; im?: number };
          if (Math.abs(comp.im || 0) < 1e-10 && isFinite(comp.re)) {
            yVal = comp.re;
          }
        }
      } catch {
        yVal = NaN;
      }

      if (!isNaN(yVal) && isFinite(yVal) && yVal >= yMin - 10 && yVal <= yMax + 10) {
        const py = toCanvasY(yVal);
        if (!isDrawing) {
          ctx.moveTo(px, py);
          isDrawing = true;
        } else {
          ctx.lineTo(px, py);
        }
      } else {
        isDrawing = false;
      }
    }
    ctx.stroke();

    // Cursor point & indicator
    if (cursor) {
      const cx = toCanvasX(cursor.x);
      const cy = toCanvasY(cursor.y);
      if (cx >= 0 && cx <= width && cy >= 0 && cy <= height) {
        ctx.fillStyle = "#ec4899";
        ctx.beginPath();
        ctx.arc(cx, cy, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
  }, [expr, range, cursor, error]);

  useEffect(() => {
    drawGraph();
  }, [drawGraph]);

  const handlePlot = (newExpr?: string) => {
    const target = newExpr ?? expr;
    if (!target.trim()) return;

    if (!isPro && !hasTrial) {
      onRequestUpgrade("Graphing Calculator");
      return;
    }

    if (!isPro) {
      consumeFreeTrial("graph");
    }

    if (newExpr) setExpr(newExpr);
    drawGraph();
  };

  const getCoordinatesAt = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const px = clientX - rect.left;
    const { xMin, xMax } = range;
    const xVal = xMin + (px / rect.width) * (xMax - xMin);

    try {
      const code = compile(normalizeExpression(expr));
      const val = code.evaluate({ x: xVal });
      if (typeof val === "number" && isFinite(val)) {
        return { x: xVal, y: val };
      } else if (val && typeof val === "object" && "re" in val) {
        const comp = val as { re: number; im?: number };
        if (Math.abs(comp.im || 0) < 1e-10 && isFinite(comp.re)) {
          return { x: xVal, y: comp.re };
        }
      }
      return null;
    } catch {
      return null;
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setCursor(getCoordinatesAt(e.clientX, e.clientY));
  };

  const handleCanvasTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 0) return;
    const touch = e.touches[0];
    setCursor(getCoordinatesAt(touch.clientX, touch.clientY));
  };

  const handleCanvasMouseLeave = () => {
    setCursor(null);
  };

  const handleZoom = (factor: number) => {
    setRange((prev) => {
      const xMid = (prev.xMin + prev.xMax) / 2;
      const yMid = (prev.yMin + prev.yMax) / 2;
      const xHalf = ((prev.xMax - prev.xMin) / 2) * factor;
      const yHalf = ((prev.yMax - prev.yMin) / 2) * factor;
      return {
        xMin: xMid - xHalf,
        xMax: xMid + xHalf,
        yMin: yMid - yHalf,
        yMax: yMid + yHalf,
      };
    });
  };

  const handleReset = () => {
    setRange({ xMin: -10, xMax: 10, yMin: -6, yMax: 6 });
  };

  return (
    <div className="w-full max-w-md mx-auto space-y-4">
      <Card className="border-border bg-card shadow-lg rounded-2xl">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              Graphing Calculator
              {!isPro && (
                <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-primary/10 text-primary flex items-center gap-1">
                  {hasTrial ? `${FREE_LIMITS.graph} Free Trial` : <Lock className="w-3 h-3" />}
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
            Plot 2D mathematical functions f(x) with interactive coordinate tracking.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">f(x) =</label>
            <div className="flex gap-2">
              <Input
                value={expr}
                onChange={(e) => setExpr(e.target.value)}
                placeholder="e.g. sin(x) or x^2 - 4"
                className="font-mono text-sm h-11"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handlePlot();
                }}
              />
              <Button
                onClick={() => handlePlot()}
                className="h-11 px-4 bg-primary text-primary-foreground font-semibold"
              >
                Plot
              </Button>
            </div>

            {/* Quick keys */}
            <div className="flex items-center gap-1 pt-1 overflow-x-auto no-scrollbar">
              {["x", "x²", "sin(", "cos(", "tan(", "sqrt(", "^", "+", "-", "*", "/"].map((sym) => (
                <button
                  key={sym}
                  type="button"
                  onClick={() => setExpr((prev) => prev + (sym === "x²" ? "^2" : sym))}
                  className="px-2.5 py-1 text-xs font-semibold rounded-md bg-muted hover:bg-secondary text-foreground transition shrink-0"
                >
                  {sym}
                </button>
              ))}
            </div>
          </div>

          {/* Quick presets */}
          <div className="space-y-1.5 pt-1">
            <div className="text-[11px] font-medium text-muted-foreground">Example Graphs:</div>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_FUNCTIONS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => {
                    setExpr(preset.expr);
                    handlePlot(preset.expr);
                  }}
                  className="px-2 py-0.5 text-xs rounded-lg border border-border bg-background hover:bg-muted font-mono text-muted-foreground hover:text-foreground transition"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {!isPro && !hasTrial && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                <Lock className="w-4 h-4 shrink-0" />
                <span>Free trial used. Upgrade to PRO for unlimited graphing.</span>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs border-amber-500/30 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20"
                onClick={() => onRequestUpgrade("Graphing Calculator")}
              >
                Upgrade
              </Button>
            </div>
          )}

          {error && (
            <div className="p-2.5 rounded-lg bg-destructive/10 text-destructive text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Canvas container */}
          <div className="relative rounded-2xl overflow-hidden border border-border bg-muted/30 aspect-[4/3] flex items-center justify-center">
            <canvas
              ref={canvasRef}
              width={400}
              height={300}
              className="w-full h-full cursor-crosshair block touch-none"
              onMouseMove={handleCanvasMouseMove}
              onMouseLeave={handleCanvasMouseLeave}
              onTouchStart={handleCanvasTouchMove}
              onTouchMove={handleCanvasTouchMove}
              onTouchEnd={handleCanvasMouseLeave}
            />

            {/* Coordinates overlay badge */}
            {cursor && (
              <div className="absolute top-2 left-2 px-2.5 py-1 rounded-md bg-background/90 backdrop-blur border border-border text-[11px] font-mono shadow-md">
                x: {cursor.x.toFixed(2)}, y: {cursor.y.toFixed(2)}
              </div>
            )}

            {/* Zoom controls */}
            <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-background/80 backdrop-blur p-1 rounded-lg border border-border shadow-md">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => handleZoom(0.8)}
                title="Zoom in"
                aria-label="Zoom in"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => handleZoom(1.25)}
                title="Zoom out"
                aria-label="Zoom out"
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={handleReset}
                title="Reset view"
                aria-label="Reset view"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
