import React, { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, Upload, Loader2, Sparkles } from "lucide-react";
import { scanMathImage } from "@/lib/cameraOcr";

interface CameraScanModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScanResult: (text: string) => void;
}

export const CameraScanModal: React.FC<CameraScanModalProps> = ({
  open,
  onOpenChange,
  onScanResult,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const startCamera = async () => {
    setErrorMessage(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setStreaming(true);
      }
    } catch (err) {
      setErrorMessage("Live camera is restricted in sandboxed web preview environment, please use photo upload or sample math demo below.");
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
    setStreaming(false);
  };

  const handleCapture = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    setLoading(true);
    const video = videoRef.current;
    const canvas = canvasRef.current;

    // Google Play Bitmap Memory Guideline: Downscale capture bitmap to prevent OOM
    let targetWidth = video.videoWidth || 640;
    let targetHeight = video.videoHeight || 480;
    const maxDim = 1024;
    if (targetWidth > maxDim || targetHeight > maxDim) {
      if (targetWidth > targetHeight) {
        targetHeight = Math.round((targetHeight * maxDim) / targetWidth);
        targetWidth = maxDim;
      } else {
        targetWidth = Math.round((targetWidth * maxDim) / targetHeight);
        targetHeight = maxDim;
      }
    }

    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (ctx) {
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
      canvas.toBlob(async (blob) => {
        // Immediate bitmap memory cleanup
        ctx.clearRect(0, 0, targetWidth, targetHeight);
        canvas.width = 0;
        canvas.height = 0;

        if (blob) {
          const text = await scanMathImage(blob);
          stopCamera();
          setLoading(false);
          onScanResult(text);
          onOpenChange(false);
        } else {
          setLoading(false);
        }
      }, "image/jpeg", 0.85);
    } else {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    const text = await scanMathImage(file);
    setLoading(false);
    stopCamera();
    onScanResult(text);
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) stopCamera();
        onOpenChange(isOpen);
      }}
    >
      <DialogContent className="max-w-md rounded-3xl p-6">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            <Camera className="w-5 h-5 text-primary" />
            Camera OCR Math Scan
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Scan numbers, formulas, or equations instantly using your camera or upload photo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 my-3">
          <div className="relative w-full h-64 bg-black/90 rounded-2xl overflow-hidden flex items-center justify-center border border-border">
            <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
            <canvas ref={canvasRef} className="hidden" />

            {!streaming && !loading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center text-white/90 space-y-3 bg-black/60">
                <Camera className="w-10 h-10 text-primary animate-pulse" />
                <p className="text-xs">Tap below to initialize live camera or upload photo</p>
                <Button
                  size="sm"
                  onClick={() => void startCamera()}
                  className="rounded-xl font-semibold gap-1.5"
                >
                  Start Camera
                </Button>
              </div>
            )}

            {loading && (
              <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center text-white space-y-2">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <span className="text-xs font-medium">Scanning Math & OCR...</span>
              </div>
            )}
          </div>

          {errorMessage && (
            <p className="text-xs text-amber-500 bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20 leading-relaxed">
              {errorMessage}
            </p>
          )}

          <div className="grid grid-cols-2 gap-2">
            {streaming ? (
              <Button
                onClick={() => void handleCapture()}
                disabled={loading}
                className="w-full rounded-xl font-semibold gap-2"
              >
                <Camera className="w-4 h-4" />
                Capture & Scan
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() => void startCamera()}
                className="w-full rounded-xl font-semibold gap-2"
              >
                <Camera className="w-4 h-4" />
                Retry Camera
              </Button>
            )}

            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="w-full rounded-xl font-semibold gap-2"
            >
              <Upload className="w-4 h-4" />
              Upload Photo
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => void handleFileUpload(e)}
            />
          </div>

          <div className="p-3 rounded-xl bg-muted/60 border border-border space-y-1">
            <span className="text-[11px] font-semibold text-muted-foreground block">Quick Math Demo OCR Samples</span>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {["15 * 4 + 10", "125 / 5", "2x + 5 = 15", "45 * 1.08"].map((sample) => (
                <button
                  key={sample}
                  type="button"
                  onClick={() => {
                    onScanResult(sample);
                    stopCamera();
                    onOpenChange(false);
                  }}
                  className="px-2 py-1 bg-background hover:bg-primary/10 border border-border rounded-lg text-[11px] font-medium transition"
                >
                  {sample}
                </button>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
