import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UNIT_OPTIONS, CURRENCY_OPTIONS, UnitCategory, convertMeasurement } from "@/lib/unitConversion";
import { crossRate, fetchLiveRates, readCachedRates, RateTable } from "@/lib/currencies";
import { useTrial } from "@/lib/freemium";
import { useNetworkMode } from "@/lib/networkMode";
import { formatWithCommas } from "@/lib/formatNumber";
import { PremiumLock } from "@/components/PremiumLock";
import { ArrowRightLeft, Lock, AlertCircle, Wifi, WifiOff } from "lucide-react";

interface ConverterViewProps {
  isPro: boolean;
  onRequestUpgrade: (featureName: string) => void;
}

const CATEGORIES: Array<{ key: UnitCategory; label: string }> = [
  { key: "currency", label: "Currency" },
  { key: "weight", label: "Weight" },
  { key: "temperature", label: "Temp" },
  { key: "length", label: "Unit" },
];

const DEFAULTS: Record<UnitCategory, [string, string]> = {
  currency: ["USD", "EUR"],
  weight: ["kg", "lb"],
  temperature: ["C", "F"],
  length: ["m", "ft"],
};

const optionsFor = (c: UnitCategory): Record<string, string> =>
  c === "currency" ? CURRENCY_OPTIONS : (UNIT_OPTIONS[c] as Record<string, string>);

export const ConverterView: React.FC<ConverterViewProps> = ({ isPro, onRequestUpgrade }) => {
  const [category, setCategory] = useState<UnitCategory>("currency");
  const [amount, setAmount] = useState("100");
  const [fromUnit, setFromUnit] = useState("USD");
  const [toUnit, setToUnit] = useState("EUR");
  const [result, setResult] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [rates, setRates] = useState<RateTable>(readCachedRates);
  const { online } = useNetworkMode();

  const currencyTrial = useTrial("currency", isPro);
  const weightTrial = useTrial("weight", isPro);
  const tempTrial = useTrial("temperature", isPro);
  const lengthTrial = useTrial("length", isPro);
  const trials = { currency: currencyTrial, weight: weightTrial, temperature: tempTrial, length: lengthTrial };
  const trial = trials[category];

  useEffect(() => {
    if (!online) {
      setRates(readCachedRates());
      return;
    }
    const ctrl = new AbortController();
    fetchLiveRates(ctrl.signal).then(setRates).catch(() => setRates(readCachedRates()));
    return () => ctrl.abort();
  }, [online]);

  const options = useMemo(() => optionsFor(category), [category]);

  const pickCategory = (c: UnitCategory) => {
    setCategory(c);
    setFromUnit(DEFAULTS[c][0]);
    setToUnit(DEFAULTS[c][1]);
    setResult("");
    setErrorMsg(null);
  };

  const label = CATEGORIES.find((c) => c.key === category)!.label;

  const handleConvert = () => {
    if (trial.locked) return onRequestUpgrade(`${label} Converter`);
    const num = parseFloat(amount.replace(/,/g, ""));
    if (isNaN(num)) return setErrorMsg("Please enter a valid number.");
    try {
      const rate = category === "currency" ? crossRate(rates, fromUnit, toUnit) : undefined;
      const res = convertMeasurement(num, category, fromUnit, toUnit, rate);
      if (!trial.use()) return onRequestUpgrade(`${label} Converter`);
      setErrorMsg(null);
      setResult(formatWithCommas(Number(res.toPrecision(10))));
    } catch (err) {
      setErrorMsg((err as Error)?.message || "Conversion failed.");
    }
  };

  const rateNote =
    rates.source === "live"
      ? "Live rates"
      : rates.updatedAt
        ? `Saved rates from ${new Date(rates.updatedAt).toLocaleDateString()}`
        : "Offline approximate rates";

  return (
    <Card className="rounded-3xl border border-border bg-card shadow-lg p-4 space-y-4">
      <div className="grid grid-cols-4 gap-1 p-1 rounded-2xl bg-muted/60">
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => pickCategory(c.key)}
            className={`py-1.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 ${
              category === c.key ? "bg-card text-foreground shadow-xs" : "text-muted-foreground"
            }`}
          >
            {c.label}
            {!isPro && trials[c.key].locked && <Lock className="w-3 h-3 text-primary" />}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{isPro ? "Unlimited Pro" : trial.locked ? <PremiumLock label="Trial used" /> : `1 free ${label.toLowerCase()} conversion`}</span>
        {category === "currency" && (
          <span className="flex items-center gap-1">
            {online ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />} {rateNote}
          </span>
        )}
      </div>

      <Input
        value={amount}
        inputMode="decimal"
        onChange={(e) => setAmount(e.target.value)}
        disabled={trial.locked}
        className="h-11 rounded-xl font-mono"
        aria-label="Amount"
      />

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <UnitSelect value={fromUnit} onChange={setFromUnit} options={options} disabled={trial.locked} />
        <Button
          variant="ghost"
          size="icon"
          aria-label="Swap units"
          onClick={() => {
            setFromUnit(toUnit);
            setToUnit(fromUnit);
          }}
        >
          <ArrowRightLeft className="w-4 h-4" />
        </Button>
        <UnitSelect value={toUnit} onChange={setToUnit} options={options} disabled={trial.locked} />
      </div>

      <Button onClick={handleConvert} className="w-full h-11 rounded-xl font-bold gap-2">
        {trial.locked ? (<><Lock className="w-4 h-4" /> Premium</>) : "Convert"}
      </Button>

      {errorMsg && (
        <div className="p-3 rounded-2xl bg-destructive/10 text-xs text-destructive flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" /> {errorMsg}
        </div>
      )}

      {result && (
        <div className="p-4 rounded-2xl bg-muted/50 border border-border">
          <div className="text-xs text-muted-foreground">{amount} {fromUnit} =</div>
          <div className="text-2xl font-extrabold font-mono text-primary break-all">{result} {toUnit}</div>
        </div>
      )}

      {trial.locked && (
        <div className="p-3 rounded-2xl bg-primary/10 border border-primary/20 text-xs flex items-center justify-between gap-2">
          <span className="flex items-center gap-2"><PremiumLock /> Free {label.toLowerCase()} trial used.</span>
          <Button size="sm" onClick={() => onRequestUpgrade(`${label} Converter`)} className="h-7 text-xs rounded-lg font-bold">
            Get Unlimited Access
          </Button>
        </div>
      )}
    </Card>
  );
};

const UnitSelect = ({
  value, onChange, options, disabled,
}: { value: string; onChange: (v: string) => void; options: Record<string, string>; disabled?: boolean }) => (
  <Select value={value} onValueChange={onChange} disabled={disabled}>
    <SelectTrigger className="h-11 rounded-xl text-xs"><SelectValue /></SelectTrigger>
    <SelectContent className="max-h-72">
      {Object.entries(options).map(([code, name]) => (
        <SelectItem key={code} value={code} className="text-xs">{name}</SelectItem>
      ))}
    </SelectContent>
  </Select>
);
