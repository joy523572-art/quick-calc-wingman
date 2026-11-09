import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { solveEquation, EquationSolution } from "@/lib/equationSolver";
import { canAccessPremiumFeature } from "@/lib/freemium";
import { downloadTextPdf } from "@/lib/historyExport";
import { useNetworkMode } from "@/lib/networkMode";
import { PremiumLock } from "@/components/PremiumLock";
import { Lock, AlertCircle, CheckCircle2, Camera, Upload, FileDown, Loader2, Calculator, Copy, Check } from "lucide-react";
import { copyToClipboard } from "@/lib/clipboard";
import { toast } from "@/hooks/use-toast";

interface EquationSolverViewProps {
  isPro: boolean;
  onRequestUpgrade: (featureName: string) => void;
}

/** Turns OCR text into something the solver understands. */
const cleanOcr = (text: string) =>
  text
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.includes("=")) // first line with an equation
    ?.replace(/[×xX](?=\d)/g, "*")
    .replace(/\s+/g, " ")
    .replace(/[—–]/g, "-") ?? text.trim();

const PRESETS = [
  "2x + 5 = 15",
  "x² - 5x + 6 = 0",
  "3x - 7 = 2x + 5",
  "x² = 16",
  "2x² + 4x - 6 = 0",
];

export const EquationSolverView: React.FC<EquationSolverViewProps> = ({ isPro, onRequestUpgrade }) => {
  const [inputEq, setInputEq] = useState("2x + 5 = 15");
  const [solution, setSolution] = useState<EquationSolution | null>(null);
  const [solvedEq, setSolvedEq] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [isSolving, setIsSolving] = useState(false);
  const cameraFileRef = useRef<HTMLInputElement>(null);
  const galleryFileRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const { online } = useNetworkMode();

  const locked = !canAccessPremiumFeature("equation", isPro);

  const handleSolve = (overrideEq?: string) => {
    if (locked) return onRequestUpgrade("Equation Solver");
    const target = (overrideEq !== undefined ? overrideEq : inputEq).trim();
    if (!target) {
      setErrorMsg("Please enter an equation, e.g. 2x + 5 = 15 or x² - 5x + 6 = 0");
      setSolution(null);
      return;
    }

    // Dismiss virtual keyboard cleanly without breaking pointer events
    if (typeof document !== "undefined" && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    setIsSolving(true);
    try {
      const res = solveEquation(target);
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
    } catch (err: unknown) {
      setErrorMsg((err as Error)?.message || "Unable to solve equation. Check syntax (e.g. 2x + 5 = 15).");
      setSolution(null);
    } finally {
      setTimeout(() => setIsSolving(false), 120);
    }
  };

  const handlePresetClick = (preset: string) => {
    setInputEq(preset);
    setErrorMsg(null);
    handleSolve(preset);
  };

  const openGallery = () => {
    if (!canAccessPremiumFeature("equation_camera", isPro)) return onRequestUpgrade("Photo Equation Upload");
    if (!online) {
      setErrorMsg("Photo upload OCR needs Online mode the first time it reads text. Switch to Online and try again.");
      return;
    }
    galleryFileRef.current?.click();
  };

  const openCamera = () => {
    if (!canAccessPremiumFeature("equation_camera", isPro)) return onRequestUpgrade("Camera Equation Scan");
    if (!online) {
      setErrorMsg("Camera scan needs Online mode the first time it reads text. Switch to Online and try again.");
      return;
    }
    cameraFileRef.current?.click();
  };

  const onPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!canAccessPremiumFeature("equation_camera", isPro)) return onRequestUpgrade("Camera Equation Scan");
    if (!file) return;
    setScanning(true);
    setErrorMsg(null);
    try {
      const { recognize } = await import("tesseract.js");
      const { data } = await recognize(file, "eng");
      const eq = cleanOcr(data.text || "");
      if (!eq || !eq.includes("=")) throw new Error("No equation found in the photo. Try a clearer, closer shot.");
      setInputEq(eq.slice(0, 4000));
      handleSolve(eq.slice(0, 4000));
    } catch (err) {
      setErrorMsg((err as Error)?.message || "Could not read the photo. Please try again.");
    } finally {
      setScanning(false);
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
            <span>Enter or upload equation</span>
          </label>
          {isPro && (
            <span className="text-[11px] text-muted-foreground font-medium">Unlimited Pro</span>
          )}
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
            placeholder="e.g. 2x + 5 = 15 or x² - 5x + 6 = 0"
            className="min-h-[120px] w-full p-3.5 rounded-2xl text-sm font-mono resize-y bg-muted/30 focus:bg-background border-border/80 transition"
          />
          <div className="flex justify-between items-center text-[11px] text-muted-foreground px-1">
            <span>Press Enter or tap Solve Equation</span>
            <span>{inputEq.length} / 4000</span>
          </div>
        </div>

        {/* Quick Example Preset Pills */}
        <div className="space-y-1">
          <div className="text-[11px] font-semibold text-muted-foreground">Quick Examples:</div>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                disabled={locked}
                onClick={() => handlePresetClick(preset)}
                className="px-2.5 py-1 rounded-xl text-xs font-mono bg-muted/50 hover:bg-primary/10 hover:text-primary active:scale-95 transition border border-border/60 text-foreground/80 cursor-pointer disabled:opacity-50"
              >
                {preset}
              </button>
            ))}
          </div>
        </div>

        {/* Action buttons: Solve Equation, Photo Upload, and Camera Scan */}
        <div className="grid grid-cols-[1fr_auto_auto] gap-2 pt-1">
          <Button
            type="submit"
            onClick={() => handleSolve()}
            disabled={isSolving}
            className="h-12 min-h-[48px] rounded-xl font-bold gap-2 text-sm bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm active:scale-95 transition-all cursor-pointer"
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
          <Button
            type="button"
            variant="outline"
            onClick={openGallery}
            disabled={scanning}
            className="h-12 min-h-[48px] px-3 rounded-xl gap-1.5 hover:bg-muted active:scale-95 transition-all cursor-pointer"
            aria-label="Upload photo of equation"
            title="Upload photo from gallery or files"
          >
            {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            <span className="text-xs font-medium">Upload</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={openCamera}
            disabled={scanning}
            className="h-12 min-h-[48px] px-3 rounded-xl gap-1.5 hover:bg-muted active:scale-95 transition-all cursor-pointer"
            aria-label="Scan equation with camera"
            title="Take photo with camera"
          >
            {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
            <span className="text-xs font-medium">Camera</span>
          </Button>
        </div>
      </form>

      {/* Hidden file inputs */}
      <input ref={galleryFileRef} type="file" accept="image/*" className="hidden" onChange={onPhoto} />
      <input ref={cameraFileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPhoto} />

      {scanning && <p className="text-xs text-muted-foreground animate-pulse">Reading equation from photo…</p>}

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
              <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-primary" /> Solution
              </span>
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
