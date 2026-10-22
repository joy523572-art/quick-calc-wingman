import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { CameraScanModal } from "@/components/CameraScanModal";
import { VoiceInputButton } from "@/components/VoiceInputButton";
import { downloadConversionPdf } from "@/lib/pdfReportGenerator";
import { copyToClipboard } from "@/lib/clipboard";
import {
  getTrialStatus,
  activateTrial,
  canUseFreeTrial,
  consumeFreeTrial,
} from "@/lib/freemium";
import { formatWithCommas } from "@/lib/formatNumber";
import {
  ArrowRightLeft,
  Camera,
  Copy,
  Check,
  FileDown,
  Sparkles,
  Lock,
} from "lucide-react";

interface ConverterViewProps {
  isPro: boolean;
  onRequestUpgrade: (featureName: string) => void;
}

export const ConverterView: React.FC<ConverterViewProps> = ({
  isPro,
  onRequestUpgrade,
}) => {
  const [category, setCategory] = useState<"currency" | "length" | "weight" | "temperature">("currency");
  const [amount, setAmount] = useState("100");
  const [fromUnit, setFromUnit] = useState("USD");
  const [toUnit, setToUnit] = useState("EUR");
  const [cameraModalOpen, setCameraModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Free trial statuses
  const conversionTrial = getTrialStatus("conversion");
  const cameraTrial = getTrialStatus("camera");
  const voiceTrial = getTrialStatus("voice");
  const pdfTrial = getTrialStatus("pdf");
  const copyTrial = getTrialStatus("copy");

  // Comprehensive Worldwide Currencies (ISO 4217) relative to USD (USD = 1)
  const exchangeRates: Record<string, number> = {
    USD: 1.0,     // United States Dollar
    EUR: 0.92,    // Euro
    GBP: 0.79,    // British Pound Sterling
    JPY: 155.0,   // Japanese Yen
    CAD: 1.36,    // Canadian Dollar
    AUD: 1.52,    // Australian Dollar
    CHF: 0.89,    // Swiss Franc
    CNY: 7.23,    // Chinese Yuan
    HKD: 7.82,    // Hong Kong Dollar
    NZD: 1.67,    // New Zealand Dollar
    SEK: 10.55,   // Swedish Krona
    KRW: 1375.0,  // South Korean Won
    SGD: 1.35,    // Singapore Dollar
    NOK: 10.85,   // Norwegian Krone
    MXN: 17.05,   // Mexican Peso
    INR: 83.35,   // Indian Rupee
    RUB: 91.5,    // Russian Ruble
    ZAR: 18.5,    // South African Rand
    BRL: 5.25,    // Brazilian Real
    TRY: 32.5,    // Turkish Lira
    AED: 3.67,    // United Arab Emirates Dirham
    SAR: 3.75,    // Saudi Riyal
    ARS: 880.0,   // Argentine Peso
    CLP: 950.0,   // Chilean Peso
    COP: 3900.0,  // Colombian Peso
    EGP: 47.5,    // Egyptian Pound
    IDR: 16200.0, // Indonesian Rupiah
    ILS: 3.72,    // Israeli New Shekel
    MYR: 4.78,    // Malaysian Ringgit
    PHP: 56.5,    // Philippine Peso
    PLN: 4.02,    // Polish Zloty
    RON: 4.58,    // Romanian Leu
    THB: 36.8,    // Thai Baht
    TWD: 32.4,    // New Taiwan Dollar
    VND: 25400.0, // Vietnamese Dong
    CZK: 23.3,    // Czech Koruna
    DKK: 6.87,    // Danish Krone
    HUF: 365.0,   // Hungarian Forint
    ISK: 138.5,   // Icelandic Króna
    PKR: 278.5,   // Pakistani Rupee
    QAR: 3.64,    // Qatari Riyal
    UAH: 39.8,    // Ukrainian Hryvnia
  };

  const lengthRates: Record<string, number> = {
    m: 1,
    cm: 100,
    mm: 1000,
    km: 0.001,
    ft: 3.28084,
    in: 39.3701,
  };

  const weightRates: Record<string, number> = {
    kg: 1,
    g: 1000,
    mg: 1000000,
    lb: 2.20462,
    oz: 35.274,
  };

  const calculateConversion = () => {
    const val = parseFloat(amount) || 0;
    if (category === "currency") {
      const base = val / (exchangeRates[fromUnit] || 1);
      const res = base * (exchangeRates[toUnit] || 1);
      return res.toFixed(2);
    } else if (category === "length") {
      const base = val / (lengthRates[fromUnit] || 1);
      const res = base * (lengthRates[toUnit] || 1);
      return res.toFixed(4);
    } else if (category === "weight") {
      const base = val / (weightRates[fromUnit] || 1);
      const res = base * (weightRates[toUnit] || 1);
      return res.toFixed(4);
    } else {
      if (fromUnit === toUnit) return val.toFixed(1);
      if (fromUnit === "C" && toUnit === "F") return (val * 9/5 + 32).toFixed(1);
      if (fromUnit === "F" && toUnit === "C") return ((val - 32) * 5/9).toFixed(1);
      return val.toFixed(1);
    }
  };

  const convertedValue = calculateConversion();

  const handleAmountChange = (val: string) => {
    if (!isPro && !canUseFreeTrial("conversion")) {
      onRequestUpgrade("Converter Suite (Premium)");
      return;
    }
    activateTrial("conversion");
    setAmount(val);
  };

  const handleConvertTrigger = () => {
    if (!isPro && !canUseFreeTrial("conversion")) {
      onRequestUpgrade("Converter Suite (Premium)");
      return;
    }
    activateTrial("conversion");
    if (!isPro) {
      consumeFreeTrial("conversion");
    }
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
    const num = text.replace(/[^0-9.]/g, "");
    if (num) setAmount(num);
  };

  const handleVoiceTranscript = (text: string) => {
    if (!isPro && !canUseFreeTrial("voice")) {
      onRequestUpgrade("Voice Math Dictation (Premium)");
      return;
    }
    activateTrial("voice");
    if (!isPro) consumeFreeTrial("voice");
    const num = text.replace(/[^0-9.]/g, "");
    if (num) setAmount(num);
  };

  const handleCopyResult = async () => {
    if (!isPro && !canUseFreeTrial("copy")) {
      onRequestUpgrade("Answer Copying (Premium)");
      return;
    }
    activateTrial("copy");
    const success = await copyToClipboard(`${amount} ${fromUnit} = ${convertedValue} ${toUnit}`);
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
    downloadConversionPdf(amount, fromUnit, convertedValue, toUnit);
  };

  const unitsForCategory = () => {
    if (category === "currency") return Object.keys(exchangeRates).sort();
    if (category === "length") return ["m", "cm", "mm", "km", "ft", "in"];
    if (category === "weight") return ["kg", "g", "mg", "lb", "oz"];
    return ["C", "F"];
  };

  const isConverterLocked = !isPro && !conversionTrial.canUse;

  return (
    <div className="space-y-4">
      <Card className="rounded-3xl border border-border bg-card shadow-lg p-4 space-y-3 relative overflow-hidden">
        {/* Category selector */}
        <div className="grid grid-cols-4 gap-1 p-1 bg-muted rounded-2xl">
          {(["currency", "length", "weight", "temperature"] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => {
                if (isConverterLocked) {
                  onRequestUpgrade("Converter Suite (Premium)");
                  return;
                }
                setCategory(cat);
                const defs: Record<string, [string, string]> = {
                  currency: ["USD", "EUR"],
                  length: ["m", "ft"],
                  weight: ["kg", "lb"],
                  temperature: ["C", "F"],
                };
                setFromUnit(defs[cat][0]);
                setToUnit(defs[cat][1]);
              }}
              className={`py-1.5 rounded-xl text-xs font-semibold capitalize transition ${
                category === cat
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">Amount to Convert</label>
              {isConverterLocked && (
                <span className="text-[10px] text-amber-500 font-semibold flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Premium
                </span>
              )}
            </div>
            <div className="flex gap-1.5 items-center mt-1">
              <Input
                type="number"
                value={amount}
                disabled={isConverterLocked}
                onChange={(e) => handleAmountChange(e.target.value)}
                className="h-11 rounded-xl text-sm flex-1"
              />
              <div className="relative">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-11 w-11 shrink-0 rounded-xl"
                  onClick={handleScanClick}
                  title={!isPro && !cameraTrial.canUse ? "Camera Scan (Premium)" : "Scan Amount OCR"}
                >
                  <Camera className="w-4 h-4 text-primary" />
                </Button>
                {!isPro && !cameraTrial.canUse && (
                  <Lock className="w-2.5 h-2.5 text-amber-500 absolute -top-1 -right-1" />
                )}
              </div>
              <div className="relative">
                <VoiceInputButton onTranscript={handleVoiceTranscript} />
                {!isPro && !voiceTrial.canUse && (
                  <Lock className="w-2.5 h-2.5 text-amber-500 absolute -top-1 -right-1" />
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground">From</label>
              <select
                value={fromUnit}
                disabled={isConverterLocked}
                onChange={(e) => {
                  if (isConverterLocked) {
                    onRequestUpgrade("Converter Suite (Premium)");
                    return;
                  }
                  setFromUnit(e.target.value);
                }}
                className="w-full h-11 mt-1 px-3 rounded-xl border border-border bg-background text-sm font-medium"
              >
                {unitsForCategory().map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">To</label>
              <select
                value={toUnit}
                disabled={isConverterLocked}
                onChange={(e) => {
                  if (isConverterLocked) {
                    onRequestUpgrade("Converter Suite (Premium)");
                    return;
                  }
                  setToUnit(e.target.value);
                }}
                className="w-full h-11 mt-1 px-3 rounded-xl border border-border bg-background text-sm font-medium"
              >
                {unitsForCategory().map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Converted Result Card */}
        <div className="p-4 rounded-2xl bg-muted/60 border border-border flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <span>Converted Result</span>
              {isConverterLocked && (
                <Lock className="w-3 h-3 text-amber-500" />
              )}
            </div>
            <div className="text-2xl font-extrabold text-primary mt-0.5">
              {isConverterLocked
                ? "🔒"
                : `${formatWithCommas(amount)} ${fromUnit} = ${formatWithCommas(convertedValue)} ${toUnit}`}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-xl relative"
              onClick={() => void handleCopyResult()}
              title={!isPro && !copyTrial.canUse ? "Copy (Premium)" : "Copy Result"}
            >
              {copied ? (
                <Check className="w-4 h-4 text-emerald-500" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
              {!isPro && !copyTrial.canUse && (
                <Lock className="w-2.5 h-2.5 text-amber-500 absolute -top-1 -right-1" />
              )}
            </Button>

            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-xl relative"
              onClick={handlePdfDownload}
              title={!isPro && !pdfTrial.canUse ? "Download PDF (Premium)" : "Download PDF"}
            >
              <FileDown className="w-4 h-4" />
              {!isPro && !pdfTrial.canUse && (
                <Lock className="w-2.5 h-2.5 text-amber-500 absolute -top-1 -right-1" />
              )}
            </Button>
          </div>
        </div>

        {/* Action Button: Free Trial or Premium */}
        {!isPro && !isConverterLocked && (
          <Button
            className="w-full h-10 rounded-xl font-semibold gap-2 mt-2"
            onClick={handleConvertTrigger}
          >
            <ArrowRightLeft className="w-4 h-4" />
            Use Free Trial Conversion (1 Trial Only)
          </Button>
        )}

        {isConverterLocked && (
          <Button
            className="w-full h-10 rounded-xl font-semibold gap-2 mt-2 bg-amber-500 hover:bg-amber-600 text-white"
            onClick={() => onRequestUpgrade("Converter Suite (Premium)")}
          >
            <Lock className="w-4 h-4" />
            Premium
          </Button>
        )}
      </Card>

      <CameraScanModal
        open={cameraModalOpen}
        onOpenChange={setCameraModalOpen}
        onScanResult={handleScanSuccess}
      />
    </div>
  );
};
