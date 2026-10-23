import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, Sparkles, Lock, RefreshCw, AlertCircle } from "lucide-react";
import { SUBSCRIPTIONS } from "@/lib/playBilling";

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  featureTrigger?: string;
  isPro: boolean;
  onPurchase: (planId: string) => Promise<boolean>;
  onRestore: () => Promise<boolean>;
}

export const UpgradeModal: React.FC<UpgradeModalProps> = ({
  open,
  onOpenChange,
  featureTrigger,
  isPro,
  onPurchase,
  onRestore,
}) => {
  const [selectedPlan, setSelectedPlan] = useState<string>("premium_monthly");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleBuy = async () => {
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const ok = await onPurchase(selectedPlan);
      if (ok) {
        setSuccessMsg("Subscription activated successfully!");
        setTimeout(() => onOpenChange(false), 1200);
      } else {
        setErrorMsg("Google Play billing is available when this app is installed from the Google Play Store.");
      }
    } catch (err: unknown) {
      setErrorMsg((err as Error)?.message || "Google Play billing is available when installed from Google Play Store.");
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const active = await onRestore();
      if (active) {
        setSuccessMsg("Purchases restored successfully!");
        setTimeout(() => onOpenChange(false), 1200);
      } else {
        setErrorMsg("No active Google Play subscription found for this account.");
      }
    } catch {
      setErrorMsg("Google Play service check completed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-3xl p-6 bg-card border border-border shadow-2xl">
        <DialogHeader className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
            <Sparkles className="w-6 h-6" />
          </div>
          <DialogTitle className="text-xl font-bold text-foreground">
            Get Unlimited Access
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {featureTrigger
              ? `Unlock ${featureTrigger} and all advanced math tools.`
              : "Upgrade to Nume Pro for unrestricted mathematical power."}
          </DialogDescription>
        </DialogHeader>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-500 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-500 flex items-start gap-2">
            <Check className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Plan Selection */}
        <div className="grid grid-cols-2 gap-3 my-2">
          {SUBSCRIPTIONS.map((plan) => {
            const isSelected = selectedPlan === plan.id;
            const isBest = plan.id === "premium_monthly";
            return (
              <div
                key={plan.id}
                onClick={() => setSelectedPlan(plan.id)}
                className={`p-3.5 rounded-2xl border cursor-pointer transition relative flex flex-col justify-between ${
                  isSelected
                    ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary"
                    : "border-border bg-muted/40 hover:bg-muted/70"
                }`}
              >
                {isBest && (
                  <span className="absolute -top-2.5 right-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary text-primary-foreground uppercase tracking-wider">
                    Best Value
                  </span>
                )}
                <div>
                  <div className="text-xs font-semibold text-foreground/80">{plan.cadence}</div>
                  <div className="text-lg font-extrabold text-foreground mt-0.5">{plan.price}</div>
                </div>
                <div className="mt-2 text-[11px] text-muted-foreground">
                  Google Play Billed
                </div>
              </div>
            );
          })}
        </div>

        {/* Features Checklist */}
        <div className="space-y-2 py-2 text-xs text-foreground/80">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-primary shrink-0" />
            <span>Unlimited 2D Graphing Calculator</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-primary shrink-0" />
            <span>Unlimited step-by-step Equation Solver</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-primary shrink-0" />
            <span>Full worldwide Currency & Unit Converter</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-primary shrink-0" />
            <span>Calculation history & PDF export reports</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-primary shrink-0" />
            <span>Zero advertisements, privacy-first offline math</span>
          </div>
        </div>

        {/* Action Button */}
        <div className="space-y-2 pt-2">
          <Button
            onClick={handleBuy}
            disabled={loading || isPro}
            className="w-full h-11 rounded-xl font-bold bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
          >
            {isPro ? (
              <>
                <Check className="w-4 h-4" />
                Active Pro Subscription
              </>
            ) : loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Contacting Google Play...
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                Subscribe via Google Play
              </>
            )}
          </Button>

          <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
            <button
              type="button"
              onClick={handleRestore}
              disabled={loading}
              className="hover:underline text-muted-foreground hover:text-foreground"
            >
              Restore Purchases
            </button>
            <span>Cancel anytime in Google Play</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
