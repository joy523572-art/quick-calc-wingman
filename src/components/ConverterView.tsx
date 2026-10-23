import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  UNIT_OPTIONS,
  UnitCategory,
  convertMeasurement,
  fetchCurrencyRate,
} from "@/lib/unitConversion";
import { canUseFreeTrial, consumeFreeTrial } from "@/lib/freemium";
import { formatWithCommas } from "@/lib/formatNumber";
import { ArrowRightLeft, Lock, Sparkles, RefreshCw, AlertCircle } from "lucide-react";

interface ConverterViewProps {
  isPro: boolean;
  onRequestUpgrade: (featureName: string) => void;
}

export const ConverterView: React.FC<ConverterViewProps> = ({
  isPro,
  onRequestUpgrade,
}) => {
  const [category, setCategory] = useState<UnitCategory>("currency");
  const [amount, setAmount] = useState<string>("100");
  const [fromUnit, setFromUnit] = useState<string>("USD");
  const [toUnit, setToUnit] = useState<string>("EUR");
  const [currencyRate, setCurrencyRate] = useState<number | undefined>(0.92);
  const [fetchingRate, setFetchingRate] = useState(false);
  const [resultVal, setResultVal] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Freemium limit: 1 free trial for free tier
  const isLocked = !isPro && !canUseFreeTrial("conversion");

  // Fetch currency rate whenever currency units change
  useEffect(() => {
    if (category !== "currency") return;
    let active = true;
    const loadRate = async () => {
      setFetchingRate(true);
      setErrorMsg(null);
      try {
        const rate = await fetchCurrencyRate(fromUnit, toUnit);
        if (active) setCurrencyRate(rate);
      } catch (err: unknown) {
        // Fallback approximate rates if offline
        const fallbackRates: Record<string, number> = {
          "USD-EUR": 0.92,
          "EUR-USD": 1.09,
          "USD-GBP": 0.79,
          "GBP-USD": 1.27,
          "USD-JPY": 155.0,
          "JPY-USD": 0.0065,
          "USD-CAD": 1.36,
          "CAD-USD": 0.74,
          "USD-AUD": 1.52,
          "AUD-USD": 0.66,
          "USD-INR": 83.3,
          "USD-NGN": 1450.0,
          "USD-GHS": 14.5,
        };
        const key = `${fromUnit}-${toUnit}`;
        if (fallbackRates[key]) {
          if (active) setCurrencyRate(fallbackRates[key]);
        } else {
          if (active) setCurrencyRate(1.0);
        }
      } finally {
        if (active) setFetchingRate(false);
      }
    };
    void loadRate();
    return () => {
      active = false;
    };
  }, [category, fromUnit, toUnit]);

  // Handle conversion calculation
  const handleConvert = () => {
    if (isLocked) {
      onRequestUpgrade("Converter Suite");
      return;
    }

    const num = parseFloat(amount);
    if (isNaN(num)) {
      setErrorMsg("Please enter a valid numeric amount to convert.");
      return;
    }

    try {
      setErrorMsg(null);
      const res = convertMeasurement(num, category, fromUnit, toUnit, currencyRate);
      setResultVal(String(res));

      if (!isPro) {
        consumeFreeTrial("conversion");
      }
    } catch (err: unknown) {
      setErrorMsg((err as Error)?.message || "Conversion failed. Please try again.");
    }
  };

  const handleCategorySwitch = (cat: UnitCategory) => {
    setCategory(cat);
    const unitKeys = Object.keys(UNIT_OPTIONS[cat]);
    setFromUnit(unitKeys[0]);
    setToUnit(unitKeys[1] || unitKeys[0]);
    setResultVal("");
    setErrorMsg(null);
  };

  const currentUnits = UNIT_OPTIONS[category] as Record<string, string>;

  return (
    <Card className="rounded-3xl border border-border bg-card shadow-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-muted-foreground">
            Category & Measurement
          </label>
          {isLocked && (
            <span className="text-[10px] text-amber-500 font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 flex items-center gap-1">
              <Lock className="w-2.5 h-2.5" /> Trial used
            </span>
          )}
        </div>
        <div className="text-[11px] text-muted-foreground">
          {isPro ? "Unlimited Pro Mode" : "1 Free Conversion"}
        </div>
      </div>

      {/* Category Tabs */}
      <div className="grid grid-cols-4 gap-1 p-1 bg-muted/60 rounded-2xl">
        {(["currency", "length", "weight", "temperature"] as const).map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => handleCategorySwitch(cat)}
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

      {/* Amount input */}
      <div>
        <label className="text-xs font-medium text-muted-foreground">
          Amount to Convert
        </label>
        <Input
          type="number"
          value={amount}
          disabled={isLocked}
          onChange={(e) => setAmount(e.target.value)}
          className="h-11 rounded-xl text-sm font-mono mt-1"
          placeholder="e.g. 100"
        />
      </div>

      {/* From and To Selector Grid */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs font-medium text-muted-foreground">From</label>
          <select
            value={fromUnit}
            disabled={isLocked}
            onChange={(e) => setFromUnit(e.target.value)}
            className="w-full h-11 mt-1 px-3 rounded-xl border border-border bg-background text-sm font-medium"
          >
            {Object.entries(currentUnits).map(([code, name]) => (
              <option key={code} value={code}>
                {code} - {name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground">To</label>
          <select
            value={toUnit}
            disabled={isLocked}
            onChange={(e) => setToUnit(e.target.value)}
            className="w-full h-11 mt-1 px-3 rounded-xl border border-border bg-background text-sm font-medium"
          >
            {Object.entries(currentUnits).map(([code, name]) => (
              <option key={code} value={code}>
                {code} - {name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Convert Action Button */}
      <Button
        onClick={handleConvert}
        disabled={fetchingRate}
        className={`w-full h-11 rounded-xl font-bold gap-2 ${
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
        ) : fetchingRate ? (
          <>
            <RefreshCw className="w-4 h-4 animate-spin" />
            Fetching Live Rate...
          </>
        ) : (
          <>
            <ArrowRightLeft className="w-4 h-4" />
            Convert
          </>
        )}
      </Button>

      {/* Error message */}
      {errorMsg && (
        <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-xs text-destructive flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Result Display */}
      {resultVal && (
        <div className="p-4 rounded-2xl bg-muted/50 border border-border space-y-1">
          <div className="text-xs font-semibold text-muted-foreground">
            Converted Result
          </div>
          <div className="text-2xl font-extrabold text-primary font-mono truncate">
            {formatWithCommas(amount)} {fromUnit} = {formatWithCommas(Number(parseFloat(resultVal).toFixed(4)).toString())} {toUnit}
          </div>
        </div>
      )}

      {isLocked && !resultVal && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-500 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 shrink-0" />
            <span>You have used your 1 free conversion trial.</span>
          </div>
          <Button
            size="sm"
            onClick={() => onRequestUpgrade("Converter Suite")}
            className="h-7 text-xs bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-bold"
          >
            Unlock Unlimited
          </Button>
        </div>
      )}
    </Card>
  );
};
