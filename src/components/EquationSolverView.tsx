import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { solveEquation } from "@/lib/equationSolver";
import {
  solveEquationWithAiFallback,
  scanAndSolveHandwrittenMath,
  EquationAiResult,
} from "@/lib/aiFallbackSystem";
import { canAccessPremiumFeature } from "@/lib/freemium";
import { consumeFeatureTrial, formatTrialTimeRemaining } from "@/lib/trialManager";
import { downloadTextPdf } from "@/lib/historyExport";
import { PremiumLock } from "@/components/PremiumLock";
import {
  Lock,
  AlertCircle,
  CheckCircle2,
  FileDown,
  Loader2,
  Calculator,
  Copy,
  Check,
  Sparkles,
  Camera,
  ImagePlus,
  X,
  Flashlight,
  Moon,
} from "lucide-react";
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
  const [isScanning, setIsScanning] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  const resultRef = useRef<HTMLDivElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const cameraCaptureInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const locked = !canAccessPremiumFeature("equation", isPro);

  const stopCameraStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setTorchSupported(false);
    setTorchOn(false);
  };

  useEffect(() => {
    return () => {
      stopCameraStream();
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const scrollResultIntoView = () => {
    setTimeout(() => {
      if (resultRef.current) {
        const rect = resultRef.current.getBoundingClientRect();
        if (rect.bottom > window.innerHeight) {
          resultRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
        }
      }
    }, 60);
  };

  const handleSolve = async (overrideEq?: string) => {
    if (locked) return onRequestUpgrade("Equation Solver");

    const target = (overrideEq !== undefined ? overrideEq : inputEq).trim();
    if (!target) {
      setErrorMsg("Please enter or scan an equation");
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
      scrollResultIntoView();
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

  const processMathPhoto = async (file: File) => {
    if (locked) return onRequestUpgrade("Equation Solver");
    if (!file) return;

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setErrorMsg(null);
    setIsScanning(true);

    try {
      const scanRes = await scanAndSolveHandwrittenMath(file);

      if (scanRes.detectedEquation) {
        setInputEq(scanRes.detectedEquation);
      }

      if (scanRes.solution) {
        if (!isPro) {
          consumeFeatureTrial("equation");
        }
        setErrorMsg(null);
        setSolution(scanRes.solution);
        setSolvedEq(scanRes.detectedEquation);
        scrollResultIntoView();
      } else {
        setSolution(null);
        setErrorMsg(
          scanRes.error ||
            "Handwriting not detected clearly. Please capture a sharper photo or edit the equation below."
        );
      }
    } catch {
      setSolution(null);
      setErrorMsg("Could not scan image. Please try again with clearer lighting or type the equation.");
    } finally {
      setIsScanning(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) {
      void processMathPhoto(file);
    }
  };

  const openCameraScanner = async () => {
    if (locked) return onRequestUpgrade("Equation Solver");

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== "function"
    ) {
      // Fallback straight to Android/iOS native camera capture input
      cameraCaptureInputRef.current?.click();
      return;
    }

    setCameraError(null);
    setCameraOpen(true);
    setCameraStarting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = stream;
      const track = stream.getVideoTracks()[0];
      const caps = track?.getCapabilities?.() as ({ torch?: boolean } & MediaTrackCapabilities) | undefined;
      setTorchSupported(Boolean(caps?.torch));
      setTorchOn(false);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch {
      setCameraError(
        "Live camera preview was blocked. You can still take a photo with your device camera below."
      );
    } finally {
      setCameraStarting(false);
    }
  };

  const toggleCameraTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track || typeof track.applyConstraints !== "function") return;
    const next = !torchOn;
    try {
      await track.applyConstraints({
        advanced: [{ torch: next }] as unknown as MediaTrackConstraintSet[],
      });
      setTorchOn(next);
    } catch {
      setTorchSupported(false);
    }
  };

  const closeCameraScanner = () => {
    stopCameraStream();
    setCameraOpen(false);
    setCameraError(null);
  };

  const captureFromLiveCamera = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      closeCameraScanner();
      cameraCaptureInputRef.current?.click();
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        closeCameraScanner();
        if (blob) {
          const capturedFile = new File([blob], `scanned-math-${Date.now()}.jpg`, {
            type: "image/jpeg",
          });
          void processMathPhoto(capturedFile);
        }
      },
      "image/jpeg",
      0.92
    );
  };

  const clearScannedPhoto = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
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
    if (!isPro) {
      consumeFeatureTrial("equation_pdf");
    }
    downloadTextPdf(
      "Nume - Equation Solution",
      [`Equation: ${solvedEq}`, `Answer: ${solution.summary}`, "", "Step-by-step:", ...solution.steps.map((s, i) => `${i + 1}. ${s}`)],
      "nume-equation-solution.pdf",
    );
  };

  return (
    <Card className="rounded-3xl border border-border bg-card shadow-lg p-4 space-y-4">
      {/* Hidden native file/camera inputs */}
      <input
        ref={uploadInputRef}
        type="file"
        accept="image/*"
        aria-label="Upload math photo"
        onChange={handleFileChange}
        className="hidden"
      />
      <input
        ref={cameraCaptureInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        aria-label="Capture math photo with camera"
        onChange={handleFileChange}
        className="hidden"
      />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSolve();
        }}
        className="space-y-4"
      >
        <div className="flex items-center justify-between gap-2">
          <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
            <Calculator className="w-3.5 h-3.5 text-primary" />
            <span>Enter or scan handwritten math</span>
          </label>
          <span className="text-[11px] font-semibold text-muted-foreground shrink-0">
            {isPro ? "Unlimited Pro" : formatTrialTimeRemaining("equation")}
          </span>
        </div>

        {/* Camera & Photo Upload Toolbar */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={isScanning || isSolving}
            onClick={() => void openCameraScanner()}
            className="h-11 rounded-xl font-semibold text-xs gap-2 border-primary/30 bg-primary/5 hover:bg-primary/10 text-foreground cursor-pointer"
          >
            {isScanning ? (
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
            ) : (
              <Camera className="w-4 h-4 text-primary" />
            )}
            <span>Camera Scan</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={isScanning || isSolving}
            onClick={() => {
              if (locked) return onRequestUpgrade("Equation Solver");
              uploadInputRef.current?.click();
            }}
            className="h-11 rounded-xl font-semibold text-xs gap-2 cursor-pointer"
          >
            {isScanning ? (
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
            ) : (
              <ImagePlus className="w-4 h-4 text-primary" />
            )}
            <span>Upload Photo</span>
          </Button>
        </div>

        {/* Scanned Handwritten Photo Preview */}
        {previewUrl && (
          <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-muted/40 border border-border/80">
            <img
              src={previewUrl}
              alt="Scanned handwritten math"
              className="w-16 h-12 object-cover rounded-xl border border-border shrink-0 bg-background"
            />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                {isScanning ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-primary shrink-0" />
                    <span>Enhancing low-light &amp; reading math…</span>
                  </>
                ) : (
                  <span>Scanned photo</span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground truncate">
                {inputEq ? `Detected: ${inputEq}` : "Night Vision & Anti-Blur auto-enhanced"}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={clearScannedPhoto}
              aria-label="Clear scanned photo"
              className="h-8 w-8 rounded-lg shrink-0 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        )}

        <div
          onClick={() => locked && onRequestUpgrade("Equation Solver")}
          className="space-y-1.5"
        >
          <Textarea
            aria-label="Equation"
            value={inputEq}
            maxLength={4000}
            readOnly={locked}
            onChange={(e) => {
              if (locked) return;
              setInputEq(e.target.value);
              if (errorMsg) setErrorMsg(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSolve();
              }
            }}
            placeholder="e.g. 2x + 5 = 15, x² - 5x + 6 = 0, or scan handwritten math"
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
            disabled={isSolving || isScanning}
            style={{ touchAction: "manipulation" }}
            className="w-full h-12 min-h-[48px] rounded-xl font-bold gap-2 text-sm bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm active:scale-95 transition-all cursor-pointer select-none"
          >
            {isScanning ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Scanning Handwriting…</span>
              </>
            ) : isSolving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Solving…</span>
              </>
            ) : locked ? (
              <>
                <Lock className="w-4 h-4" /> Unlock All Features
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

      {/* Live Camera Math Scanner Modal */}
      <Dialog
        open={cameraOpen}
        onOpenChange={(open) => {
          if (!open) closeCameraScanner();
        }}
      >
        <DialogContent className="max-w-md rounded-3xl p-4 sm:p-5 bg-card border border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Camera className="w-4 h-4 text-primary" />
              Scan Handwritten Math
            </DialogTitle>
            <DialogDescription className="text-xs">
              Night Vision &amp; Anti-Blur enhancement automatically clarifies dim or blurry handwriting.
            </DialogDescription>
          </DialogHeader>

          <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden bg-black border border-border flex items-center justify-center">
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className="w-full h-full object-cover"
            />
            {!cameraError && (
              <>
                <div className="pointer-events-none absolute inset-6 border-2 border-dashed border-primary/80 rounded-2xl shadow-sm" />
                <div className="pointer-events-none absolute top-2.5 left-2.5 px-2 py-1 rounded-lg bg-black/65 text-white text-[10px] font-semibold flex items-center gap-1 backdrop-blur-xs">
                  <Moon className="w-3 h-3 text-primary" />
                  <span>Night Vision Ready</span>
                </div>
                {torchSupported && (
                  <Button
                    type="button"
                    size="sm"
                    variant={torchOn ? "default" : "secondary"}
                    onClick={() => void toggleCameraTorch()}
                    aria-label={torchOn ? "Turn flashlight off" : "Turn flashlight on"}
                    className="absolute top-2.5 right-2.5 h-8 px-2.5 rounded-lg text-[11px] font-semibold gap-1.5 cursor-pointer"
                  >
                    <Flashlight className="w-3.5 h-3.5" />
                    <span>{torchOn ? "Flash On" : "Flash"}</span>
                  </Button>
                )}
              </>
            )}
            {cameraStarting && (
              <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-2 text-white text-xs">
                <Loader2 className="w-6 h-6 animate-spin" />
                <span>Starting camera…</span>
              </div>
            )}
            {cameraError && (
              <div className="absolute inset-0 bg-card/95 p-4 flex flex-col items-center justify-center text-center gap-3">
                <AlertCircle className="w-6 h-6 text-amber-500" />
                <p className="text-xs text-muted-foreground leading-relaxed">{cameraError}</p>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    closeCameraScanner();
                    cameraCaptureInputRef.current?.click();
                  }}
                  className="rounded-xl text-xs font-bold gap-1.5 cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5" />
                  Open Device Camera
                </Button>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                closeCameraScanner();
                cameraCaptureInputRef.current?.click();
              }}
              className="rounded-xl text-xs cursor-pointer"
            >
              Device Camera
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={closeCameraScanner}
              className="rounded-xl text-xs cursor-pointer"
            >
              Cancel
            </Button>
            {!cameraError && (
              <Button
                type="button"
                onClick={captureFromLiveCamera}
                disabled={cameraStarting}
                className="rounded-xl text-xs font-bold gap-1.5 bg-primary text-primary-foreground cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5" />
                Capture & Solve
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
