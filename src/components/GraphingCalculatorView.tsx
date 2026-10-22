import React, { useState } from "react";
import { evaluate } from "mathjs";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { CameraScanModal } from "@/components/CameraScanModal";
import { VoiceInputButton } from "@/components/VoiceInputButton";
import { downloadGraphPdf } from "@/lib/pdfReportGenerator";
import { copyToClipboard } from "@/lib/clipboard";
import {
  getTrialStatus,
  activateTrial,
  canUseFreeTrial,
  consumeFreeTrial,
} from "@/lib/freemium";
import {
  Camera,
  Copy,
  Check,
  FileDown,
  Lock,
  Sparkles,
} from "lucide-react";

interface GraphingCalculatorViewProps {
  isPro: boolean;
  onRequestUpgrade: (featureName: string) => void;
}

export const GraphingCalculatorView: React.FC<GraphingCalculatorViewProps> = ({
  isPro,
  onRequestUpgrade,
}) => {
  const [fnString, setFnString] = useState("x^2");
  const [inputVal, setInputVal] = useState("x^2");
  const [cameraModalOpen, setCameraModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Free trial statuses
  const graphTrial = getTrialStatus("graph");
  const cameraTrial = getTrialStatus("camera");
  const voiceTrial = getTrialStatus("voice");
  const copyTrial = getTrialStatus("copy");
  const pdfTrial = getTrialStatus("pdf");

  const handlePlot = () => {
    if (!isPro && !canUseFreeTrial("graph")) {
      onRequestUpgrade("Graphing Calculator (Premium)");
      return;
    }
    activateTrial("graph");
    if (!isPro) {
      consumeFreeTrial("graph");
    }
    setFnString(inputVal);
  };

  const handleScanClick = () => {
    if (!isPro && !canUseFreeTrial("camera")) {
      onRequestUpgrade("Camera OCR Math Scan (Premium)");
      return;
    }
    activateTrial("camera");
    setCameraModalOpen(true);
  };

  const handleScanSuccess = (text: string) => {
    if (!isPro) consumeFreeTrial("camera");
    setInputVal(text);
    setFnString(text);
  };

  const handleVoiceTranscript = (text: string) => {
    if (!isPro && !canUseFreeTrial("voice")) {
      onRequestUpgrade("Voice Math Dictation (Premium)");
      return;
    }
    activateTrial("voice");
    if (!isPro) consumeFreeTrial("voice");
    setInputVal(text);
    setFnString(text);
  };

  const handleCopy = async () => {
    if (!isPro && !canUseFreeTrial("copy")) {
      onRequestUpgrade("Answer Copying (Premium)");
      return;
    }
    activateTrial("copy");
    const success = await copyToClipboard(`f(x) = ${fnString}`);
    if (success) {
      if (!isPro) consumeFreeTrial("copy");
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const handlePdfDownload = () => {
    if (!isPro && !canUseFreeTrial("pdf")) {
      onRequestUpgrade("PDF Export (Premium)");
      return;
    }
    activateTrial("pdf");
    if (!isPro) consumeFreeTrial("pdf");
    downloadGraphPdf(fnString, data.length);
  };

  // Generate plot data
  const data = React.useMemo(() => {
    const points = [];
    for (let x = -10; x <= 10; x += 0.5) {
      try {
        const scope = { x };
        const y = evaluate(fnString, scope);
        if (typeof y === "number" && !isNaN(y) && isFinite(y)) {
          points.push({ x: Number(x.toFixed(1)), y: Number(y.toFixed(2)) });
        }
      } catch {
        // ignore evaluation error for invalid x
      }
    }
    return points;
  }, [fnString]);

  const isGraphLocked = !isPro && !graphTrial.canUse;  return (
    <div className="space-y-4">
      <Card className="rounded-3xl border border-border bg-card shadow-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-muted-foreground">Function f(x)</label>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-[11px] font-semibold gap-1 relative"
              onClick={handleScanClick}
              title={!isPro && !cameraTrial.canUse ? "Camera Scan (Premium)" : "Scan"}
            >
              <Camera className="w-3 h-3 text-primary" />
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
          </div>
        </div>

        <div className="flex gap-2">
          <Input
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            placeholder="e.g. x^2 - 4 or sin(x)"
            className="h-11 rounded-xl text-sm"
          />
          <Button
            onClick={handlePlot}
            className={`h-11 px-4 rounded-xl font-semibold gap-1.5 ${
              isGraphLocked ? "bg-amber-500 hover:bg-amber-600 text-white" : ""
            }`}
          >
            {isGraphLocked ? (
              <>
                <Lock className="w-4 h-4" />
                Premium
              </>
            ) : (
              "Plot"
            )}
          </Button>
        </div>

        <div className="w-full h-64 bg-muted/40 rounded-2xl border border-border p-2 pt-4">
          {data.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="x" stroke="#888888" fontSize={10} />
                <YAxis stroke="#888888" fontSize={10} />
                <Tooltip />
                <Line type="monotone" dataKey="y" stroke="#7c3aed" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
              Unable to plot function. Check expression syntax.
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-muted-foreground">Sampled {data.length} coordinate points</span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 rounded-xl text-xs gap-1.5 relative"
              onClick={() => void handleCopy()}
              title={!isPro && !copyTrial.canUse ? "Copy (Premium)" : "Copy Function"}
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              <span>Copy</span>
              {!isPro && !copyTrial.canUse && (
                <Lock className="w-2.5 h-2.5 text-amber-500 ml-0.5" />
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 rounded-xl text-xs gap-1.5 relative"
              onClick={handlePdfDownload}
              title={!isPro && !pdfTrial.canUse ? "PDF (Premium)" : "Export PDF"}
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>PDF</span>
              {!isPro && !pdfTrial.canUse && (
                <Lock className="w-2.5 h-2.5 text-amber-500 ml-0.5" />
              )}
            </Button>
          </div>
        </div>
      </Card>

      <CameraScanModal
        open={cameraModalOpen}
        onOpenChange={setCameraModalOpen}
        onScanResult={handleScanSuccess}
      />
    </div>
  );
};
