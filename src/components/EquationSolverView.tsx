import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { solveEquation, EquationSolution } from "@/lib/equationSolver";
import { useTrial } from "@/lib/freemium";
import { downloadTextPdf } from "@/lib/historyExport";
import { useNetworkMode } from "@/lib/networkMode";
import { PremiumLock } from "@/components/PremiumLock";
import { Lock, AlertCircle, CheckCircle2, Camera, FileDown, Loader2 } from "lucide-react";

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

export const EquationSolverView: React.FC<EquationSolverViewProps> = ({ isPro, onRequestUpgrade }) => {
  const [inputEq, setInputEq] = useState("");
  const [solution, setSolution] = useState<EquationSolution | null>(null);
  const [solvedEq, setSolvedEq] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { online } = useNetworkMode();

  const solveTrial = useTrial("equation", isPro);
  const cameraTrial = useTrial("equation_camera", isPro);
  const pdfTrial = useTrial("equation_pdf", isPro);

  const handleSolve = () => {
    if (solveTrial.locked) return onRequestUpgrade("Equation Solver");
    if (!inputEq.trim()) {
      setErrorMsg("Please enter an equation, e.g. 2x + 5 = 15 or x² - 5x + 6 = 0");
      return;
    }
    try {
      const res = solveEquation(inputEq);
      // Only a successful solve uses the free trial.
      if (!solveTrial.use()) return onRequestUpgrade("Equation Solver");
      setErrorMsg(null);
      setSolution(res);
      setSolvedEq(inputEq);
    } catch (err: unknown) {
      setErrorMsg((err as Error)?.message || "Unable to solve equation. Check syntax (e.g. 2x + 5 = 15).");
      setSolution(null);
    }
  };

  const openCamera = () => {
    if (cameraTrial.locked) return onRequestUpgrade("Camera Equation Scan");
    if (!online) {
      setErrorMsg("Camera scan needs Online mode the first time it reads text. Switch to Online and try again.");
      return;
    }
    fileRef.current?.click();
  };

  const onPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setScanning(true);
    setErrorMsg(null);
    try {
      const { recognize } = await import("tesseract.js");
      const { data } = await recognize(file, "eng");
      const eq = cleanOcr(data.text || "");
      if (!eq || !eq.includes("=")) throw new Error("No equation found in the photo. Try a clearer, closer shot.");
      if (!cameraTrial.use()) return onRequestUpgrade("Camera Equation Scan");
      setInputEq(eq.slice(0, 4000));
    } catch (err) {
      setErrorMsg((err as Error)?.message || "Could not read the photo. Please try again.");
    } finally {
      setScanning(false);
    }
  };

  const downloadPdf = () => {
    if (!solution) return;
    if (pdfTrial.locked) return onRequestUpgrade("Download Answers as PDF");
    if (!pdfTrial.use()) return onRequestUpgrade("Download Answers as PDF");
    downloadTextPdf(
      "Nume - Equation Solution",
      [`Equation: ${solvedEq}`, `Answer: ${solution.summary}`, "", "Step-by-step:", ...solution.steps.map((s, i) => `${i + 1}. ${s}`)],
      "nume-equation-solution.pdf",
    );
  };

  const samples = ["2x + 5 = 15", "x² - 5x + 6 = 0", "3x - 9 = 0", "2x² + 4x - 6 = 0"];
  const locked = solveTrial.locked;

  return (
    <Card className="rounded-3xl border border-border bg-card shadow-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-muted-foreground">Enter equation</label>
        {isPro ? (
          <span className="text-[11px] text-muted-foreground">Unlimited Pro</span>
        ) : locked ? (
          <PremiumLock label="Trial used" />
        ) : (
          <span className="text-[11px] text-muted-foreground">1 free solve</span>
        )}
      </div>

      <div className="space-y-1.5">
        <Textarea
          value={inputEq}
          maxLength={4000}
          disabled={locked}
          onChange={(e) => {
            setInputEq(e.target.value);
            if (errorMsg) setErrorMsg(null);
          }}
          placeholder="e.g. 2x + 5 = 15 or x² - 5x + 6 = 0"
          className="min-h-[90px] w-full p-3 rounded-2xl text-sm font-mono resize-y bg-muted/30 disabled:opacity-50"
        />
        <div className="flex justify-end text-[11px] text-muted-foreground px-1">{inputEq.length} / 4000</div>
      </div>

      {!locked && (
        <div className="flex flex-wrap gap-1.5">
          {samples.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setInputEq(s)}
              className="px-2.5 py-1 rounded-lg text-xs font-mono bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/50"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-[1fr_auto] gap-2">
        <Button onClick={handleSolve} className="h-11 rounded-xl font-bold gap-2">
          {locked ? (<><Lock className="w-4 h-4" /> Premium</>) : "Solve Equation"}
        </Button>
        <Button variant="outline" onClick={openCamera} disabled={scanning} className="h-11 rounded-xl gap-1.5" aria-label="Scan equation with camera">
          {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
          <span className="text-xs">Scan</span>
          {!isPro && cameraTrial.locked && <Lock className="w-3 h-3 text-primary" />}
        </Button>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPhoto} />
      </div>
      {scanning && <p className="text-xs text-muted-foreground">Reading equation from photo…</p>}

      {errorMsg && (
        <div className="p-3 rounded-2xl bg-destructive/10 border border-destructive/20 text-xs text-destructive flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {solution && (
        <div className="p-4 rounded-2xl bg-muted/50 border border-border space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-primary flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Solution
            </span>
            <Button size="sm" variant="outline" onClick={downloadPdf} className="h-7 text-xs gap-1 rounded-lg">
              <FileDown className="w-3.5 h-3.5" /> PDF
              {!isPro && pdfTrial.locked && <Lock className="w-3 h-3 text-primary" />}
            </Button>
          </div>
          <div className="text-xl font-extrabold font-mono">{solution.summary}</div>
          <div className="pt-2 border-t border-border/60 space-y-1.5">
            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Step-by-step</div>
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

      {locked && (
        <div className="p-3 rounded-2xl bg-primary/10 border border-primary/20 text-xs flex items-center justify-between gap-2">
          <span className="flex items-center gap-2"><PremiumLock /> You used your 1 free solve.</span>
          <Button size="sm" onClick={() => onRequestUpgrade("Equation Solver")} className="h-7 text-xs rounded-lg font-bold">
            Get Unlimited Access
          </Button>
        </div>
      )}
    </Card>
  );
};
