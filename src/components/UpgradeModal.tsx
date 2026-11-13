import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, Sparkles, Lock, RefreshCw, AlertCircle, ShieldAlert, CheckCircle2 } from "lucide-react";
import { isPlayBillingAvailable, SUBSCRIPTIONS, SubscriptionPlan } from "@/lib/playBilling";

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  featureTrigger?: string;
  isPro: boolean;
  isBlocked?: boolean;
  onPurchase: (productId: string, basePlanId: string) => Promise<boolean>;
  onRestore: () => Promise<boolean>;
  onSubscriptionResult?: (success: boolean, planId: string, error?: string) => void;
}

export const UpgradeModal: React.FC<UpgradeModalProps> = ({
  open,
  onOpenChange,
  featureTrigger,
  isPro,
  isBlocked = false,
  onPurchase,
  onRestore,
  onSubscriptionResult,
}) => {
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan>(SUBSCRIPTIONS[0]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleBuy = async () => {
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const ok = await onPurchase(selectedPlan.productId, selectedPlan.basePlanId);
      if (ok) {
        setSuccessMsg(`Subscription to ${selectedPlan.cadence} confirmed via Google Play!`);
        onSubscriptionResult?.(true, selectedPlan.id);
        setTimeout(() => {
          onOpenChange(false);
        }, 1400);
      } else {
        const msg = "Subscription could not be completed. Please try again.";
        setErrorMsg(msg);
        onSubscriptionResult?.(false, selectedPlan.id, msg);
      }
    } catch (err: unknown) {
      const msg =
        (err as Error)?.message ||
        "Google Play subscription could not be completed. Please check your account and try again.";
      setErrorMsg(msg);
      onSubscriptionResult?.(false, selectedPlan.id, msg);
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
        setSuccessMsg("PRO subscription restored successfully from Google Play!");
        onSubscriptionResult?.(true, "restored");
        setTimeout(() => onOpenChange(false), 1200);
      } else {
        const msg = "No active PRO subscription found in Google Play for this account.";
        setErrorMsg(msg);
        onSubscriptionResult?.(false, "Restore", msg);
      }
    } catch {
      const msg = "Google Play subscription verification completed.";
      setErrorMsg(msg);
      onSubscriptionResult?.(false, "Restore", msg);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChangeInternal = (newOpen: boolean) => {
    onOpenChange(newOpen);
  };

  const playAvailable = isPlayBillingAvailable();

  return (
    <Dialog open={open} onOpenChange={handleOpenChangeInternal}>
      <DialogContent className="max-w-md rounded-3xl p-6 bg-card border border-border shadow-2xl">
        <DialogHeader className="text-center space-y-2">
          <div
            className={`mx-auto w-12 h-12 rounded-2xl flex items-center justify-center ${
              isBlocked && !isPro
                ? "bg-amber-500/10 text-amber-500"
                : "bg-primary/10 text-primary"
            }`}
          >
            {isBlocked && !isPro ? (
              <ShieldAlert className="w-6 h-6" />
            ) : (
              <Sparkles className="w-6 h-6" />
            )}
          </div>
          <DialogTitle className="text-xl font-bold text-foreground">
            {isBlocked && !isPro
              ? "Free Trial Uses Reached"
              : featureTrigger
              ? `Unlock ${featureTrigger}`
              : "Unlock All Features"}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {isBlocked && !isPro
              ? "You have used your 3 free lifetime trials for this advanced feature. Subscribe to unlock all features without limits."
              : featureTrigger
              ? `Your free trial uses for ${featureTrigger} are complete. Unlock All Features to keep using all tools forever.`
              : "Choose a subscription plan via Google Play In-App Billing for unlimited access to all calculator features."}
          </DialogDescription>
        </DialogHeader>

        {errorMsg && (
          <div className="p-3.5 rounded-2xl bg-destructive/10 border border-destructive/20 text-xs text-destructive flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-destructive" />
            <div className="space-y-0.5">
              <span className="font-semibold block">Google Play Notice</span>
              <span className="leading-relaxed block">{errorMsg}</span>
            </div>
          </div>
        )}

        {successMsg && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-500 flex items-start gap-2">
            <Check className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Subscription Plan Selection Cards */}
        <div className="grid grid-cols-2 gap-3 my-2">
          {SUBSCRIPTIONS.map((plan) => {
            const isSelected = selectedPlan.id === plan.id;
            return (
              <button
                key={plan.id}
                type="button"
                onClick={() => setSelectedPlan(plan)}
                className={`p-3.5 rounded-2xl border text-left transition relative flex flex-col justify-between ${
                  isSelected
                    ? "border-primary bg-primary/5 ring-2 ring-primary"
                    : "border-border bg-card hover:border-primary/50"
                }`}
              >
                {isSelected && (
                  <span className="absolute -top-2 right-3 px-2 py-0.5 rounded-full text-[9px] font-bold bg-primary text-primary-foreground uppercase tracking-wider">
                    Selected
                  </span>
                )}
                <div>
                  <div className="text-xs font-semibold text-muted-foreground">
                    {plan.id === "premium_monthly" ? "Monthly Plan" : "Weekly Plan"}
                  </div>
                  <div className="text-xl font-black text-foreground mt-0.5">{plan.price}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{plan.cadence}</div>
                </div>
                <div className="mt-3 flex items-center gap-1 text-[11px] font-bold text-primary">
                  <CheckCircle2 className={`w-3.5 h-3.5 ${isSelected ? "opacity-100" : "opacity-40"}`} />
                  <span>{isSelected ? "Selected" : "Select"}</span>
                </div>
              </button>
            );
          })}
        </div>

        {!playAvailable && (
          <div className="p-3 rounded-xl bg-muted/60 border border-border text-[11px] text-muted-foreground leading-relaxed">
            Google Play In-App Billing activates automatically when opening this app from your installed Android app via the Google Play Store.
          </div>
        )}

        {/* Features Checklist */}
        <div className="space-y-1.5 py-1 text-xs text-foreground/80">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-primary shrink-0" />
            <span>Unlock All Features (Graphing, Solver, History)</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-primary shrink-0" />
            <span>Full worldwide Currency & Unit Converter</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-primary shrink-0" />
            <span>Calculation history & PDF report exports</span>
          </div>
          <div className="flex items-center gap-2 font-semibold text-primary">
            <Check className="w-4 h-4 text-primary shrink-0" />
            <span>Verified via Google Digital Goods API.</span>
          </div>
        </div>

        {/* Action Button */}
        <div className="space-y-2 pt-1">
          <Button
            onClick={handleBuy}
            disabled={loading || isPro}
            className="w-full h-11 rounded-xl font-bold bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
          >
            {isPro ? (
              <>
                <Check className="w-4 h-4" />
                Subscription Active
              </>
            ) : loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Processing Subscription...
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                Unlock All Features ({selectedPlan.price})
              </>
            )}
          </Button>

          <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
            <button
              type="button"
              onClick={handleRestore}
              disabled={loading}
              className="hover:underline text-muted-foreground hover:text-foreground font-medium"
            >
              Restore Subscription
            </button>
            <span className="text-[10px] text-muted-foreground">Google Play Billing</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
