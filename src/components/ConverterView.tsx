import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  UNIT_OPTIONS,
  type UnitCategory,
  convertMeasurement,
  fetchCurrencyRate,
} from "@/lib/unitConversion";
import { canUseFreeTrial, consumeFreeTrial, FREE_LIMITS } from "@/lib/freemium";
import { ArrowRightLeft, Lock, Loader2, Sparkles } from "lucide-react";

interface ConverterViewProps {
  isPro: boolean;
  onRequestUpgrade: (feature: string) => void;
}

export const ConverterView: React.FC<ConverterViewProps> = ({
  isPro,
  onRequestUpgrade,
}) => {
  const [category, setCategory] = useState<UnitCategory>("length");
  const [amount, setAmount] = useState<string>("1");
  const [fromUnit, setFromUnit] = useState<string>("km");
  const [toUnit, setToUnit] = useState<string>("m");
  const [result, setResult] = useState<string>("");
  const [currencyRate, setCurrencyRate] = useState<number | null>(null);
  const [loadingRate, setLoadingRate] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasTrial = canUseFreeTrial("conversion");

  // When category changes, set default from/to units
  useEffect(() => {
    const keys = Object.keys(UNIT_OPTIONS[category]);
    if (category === "currency") {
      setFromUnit("USD");
      setToUnit("EUR");
    } else if (category === "length") {
      setFromUnit("km");
      setToUnit("m");
    } else if (category === "weight") {
      setFromUnit("kg");
      setToUnit("lb");
    } else {
      setFromUnit("C");
      setToUnit("F");
    }
    setResult("");
  }, [category]);

  // Fetch currency rates when currency units change
  useEffect(() => {
    if (category !== "currency") return;
    let active = true;
    const controller = new AbortController();

    async function loadRate() {
      setLoadingRate(true);
      setError(null);
      try {
        const rate = await fetchCurrencyRate(fromUnit, toUnit, controller.signal);
        if (active) setCurrencyRate(rate);
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Exchange rate unavailable");
          setCurrencyRate(null);
        }
      } finally {
        if (active) setLoadingRate(false);
      }
    }

    void loadRate();
    return () => {
      active = false;
      controller.abort();
    };
  }, [category, fromUnit, toUnit]);

  // Perform conversion
  const handleConvert = () => {
    const val = parseFloat(amount);
    if (isNaN(val)) {
      setError("Please enter a valid number");
      setResult("");
      return;
    }

    if (!isPro && !hasTrial) {
      onRequestUpgrade("Unit & Currency Converter");
      return;
    }

    try {
      setError(null);
      const converted = convertMeasurement(
        val,
        category,
        fromUnit,
        toUnit,
        currencyRate ?? undefined
      );

      if (!isPro) {
        consumeFreeTrial("conversion");
      }

      const formatted = Number.isInteger(converted)
        ? converted.toString()
        : Number(converted.toPrecision(8)).toString();

      setResult(formatted);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Conversion error");
      setResult("");
    }
  };

  // Only auto-update if the user is already PRO and has a result displayed
  useEffect(() => {
    if (isPro && result && amount && (category !== "currency" || currencyRate !== null)) {
      handleConvert();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amount, category, fromUnit, toUnit, currencyRate, isPro]);

  const handleSwap = () => {
    const temp = fromUnit;
    setFromUnit(toUnit);
    setToUnit(temp);
  };

  const currentUnits = UNIT_OPTIONS[category];

  return (
    <div className="w-full max-w-md mx-auto space-y-4">
      <Card className="border-border bg-card shadow-lg rounded-2xl">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              Unit & Currency Converter
              {!isPro && (
                <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-primary/10 text-primary flex items-center gap-1">
                  {hasTrial ? `${FREE_LIMITS.conversion} Free Trial` : <Lock className="w-3 h-3" />}
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
            Accurate length, weight, temperature, and live currency conversions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs
            value={category}
            onValueChange={(val) => setCategory(val as UnitCategory)}
            className="w-full"
          >
            <TabsList className="grid grid-cols-4 w-full h-9 bg-muted rounded-xl p-1">
              <TabsTrigger value="length" className="text-xs rounded-lg">Length</TabsTrigger>
              <TabsTrigger value="weight" className="text-xs rounded-lg">Weight</TabsTrigger>
              <TabsTrigger value="temperature" className="text-xs rounded-lg">Temp</TabsTrigger>
              <TabsTrigger value="currency" className="text-xs rounded-lg">Currency</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Amount to Convert</label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="font-mono text-base h-11 mt-1"
              />
            </div>

            <div className="grid grid-cols-5 gap-2 items-center">
              <div className="col-span-2">
                <label className="text-[11px] font-medium text-muted-foreground block mb-1">From</label>
                <Select value={fromUnit} onValueChange={setFromUnit}>
                  <SelectTrigger className="h-10 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(currentUnits).map(([code, name]) => (
                      <SelectItem key={code} value={code} className="text-xs">
                        {code.toUpperCase()} ({name})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-1 flex justify-center pt-5">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleSwap}
                  className="rounded-full h-8 w-8 hover:bg-muted"
                  aria-label="Swap units"
                >
                  <ArrowRightLeft className="w-4 h-4 text-muted-foreground" />
                </Button>
              </div>

              <div className="col-span-2">
                <label className="text-[11px] font-medium text-muted-foreground block mb-1">To</label>
                <Select value={toUnit} onValueChange={setToUnit}>
                  <SelectTrigger className="h-10 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(currentUnits).map(([code, name]) => (
                      <SelectItem key={code} value={code} className="text-xs">
                        {code.toUpperCase()} ({name})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              onClick={handleConvert}
              className="w-full h-11 text-sm font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Convert
            </Button>

            {loadingRate && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Fetching live market exchange rate...
              </div>
            )}

            {!isPro && !hasTrial && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs flex items-center justify-between">
                <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                  <Lock className="w-4 h-4 shrink-0" />
                  <span>Free trial used. Upgrade to PRO for unlimited conversions.</span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs border-amber-500/30 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20"
                  onClick={() => onRequestUpgrade("Unit & Currency Converter")}
                >
                  Upgrade
                </Button>
              </div>
            )}

            {error && (
              <div className="p-2.5 rounded-lg bg-destructive/10 text-destructive text-xs">
                {error}
              </div>
            )}

            {result && (
              <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 space-y-1">
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-primary" />
                  Converted Result
                </div>
                <div className="text-2xl font-bold font-mono text-foreground truncate">
                  {result} <span className="text-sm font-semibold text-primary">{toUnit.toUpperCase()}</span>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {amount} {fromUnit.toUpperCase()} = {result} {toUnit.toUpperCase()}
                  {category === "currency" && currencyRate && (
                    <span className="block mt-0.5 text-[10px]">
                      1 {fromUnit.toUpperCase()} ≈ {currencyRate.toFixed(4)} {toUnit.toUpperCase()}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
