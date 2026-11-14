import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Check,
  Sparkles,
  Lock,
  RefreshCw,
  AlertCircle,
  ShieldAlert,
  CheckCircle2,
} from "lucide-react";
import {
  isPlayBillingAvailable,
  SUBSCRIPTIONS,
  SUBSCRIPTION_TAG,
  SubscriptionPlan,
} from "@/lib/playBilling";

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  featureTrigger?: string;
  isPro: boolean;
  isBlocked?: boolean;
  plans?: SubscriptionPlan[];
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
  plans,
  onPurchase,
  onRestore,
  onSubscriptionResult,
}) => {
  const availablePlans = plans && plans.length > 0 ? plans : SUBSCRIPTIONS;
  const [selectedPlanId, setSelectedPlanId] = useState<string>(
    () => availablePlans[0]?.id || "premium_monthly"
  );

  const selectedPlan =
    availablePlans.find((p) => p.id === selectedPlanId || p.productId === selectedPlanId) ||
    availablePlans[0];

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
        setSuccessMsg(`${selectedPlan.title} confirmed via Google Play.`);
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
        setSuccessMsg("Subscription restored successfully from Google Play.");
        onSubscriptionResult?.(true, "restored");
        setTimeout(() => onOpenChange(false), 1200);
      } else {
        const msg = "No active subscription found in Google Play for this account.";
        setErrorMsg(msg);
        onSubscriptionResult?.(false, "Restore", msg);
      }
    } catch {
      const msg = "Unable to verify Google Play subscription right now.";
      setErrorMsg(msg);
      onSubscriptionResult?.(false, "Restore", msg);
    } finally {
      setLoading(false);
    }
  };

  const playAvailable = isPlayBillingAvailable();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-3xl p-6 bg-card border border-border shadow-2xl">
        <DialogHeader className="text-center space-y-2">
          <div className="mx-auto flex flex-col items-center gap-2">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
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
            <span className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-primary">
              {SUBSCRIPTION_TAG}
            </span>
          </div>

          <DialogTitle className="text-xl font-bold text-foreground">
            {isBlocked && !isPro
              ? "Free Trial Uses Complete"
              : featureTrigger && featureTrigger !== SUBSCRIPTION_TAG
              ? `Unlock ${featureTrigger}`
              : SUBSCRIPTION_TAG}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
            {featureTrigger && featureTrigger !== SUBSCRIPTION_TAG
              ? `Subscribe for unlimited access to ${featureTrigger} and all advanced tools.`
              : "Choose a subscription plan below for unlimited access to Graphing, Equation Solver, Converter, History, and PDF Export."}
          </DialogDescription>
        </DialogHeader>

        {errorMsg && (
          <div className="p-3.5 rounded-2xl bg-destructive/10 text-xs text-destructive flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-destructive" />
            <div className="space-y-0.5">
              <span className="font-semibold block">Google Play Notice</span>
              <span className="leading-relaxed block">{errorMsg}</span>
            </div>
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 text-xs text-emerald-600 dark:text-emerald-400 flex items-start gap-2">
            <Check className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="font-medium">{successMsg}</span>
          </div>
        )}

        {/* Subscription Tier Selection Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-1">
          {availablePlans.map((plan) => {
            const isSelected = selectedPlan.id === plan.id;
            const isMonthly = plan.id === "premium_monthly";
            return (
              <button
                key={plan.id}
                type="button"
                onClick={() => setSelectedPlanId(plan.id)}
                className={`min-h-[124px] p-4 rounded-2xl border text-left transition relative flex flex-col justify-between cursor-pointer ${
                  isSelected
                    ? "border-primary bg-primary/5 ring-2 ring-primary"
                    : "border-border bg-background/60 hover:border-primary/50"
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-foreground">
                      {plan.title}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-2xl font-black text-foreground">
                      {plan.formattedPrice}
                    </span>
                    <span className="text-xs font-medium text-muted-foreground">
                      {isMonthly ? "/ month" : "/ week"}
                    </span>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {isMonthly ? "Best value · Auto-renews monthly" : "Flexible · Auto-renews weekly"}
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-1.5 text-xs font-bold text-primary">
                  <CheckCircle2
                    className={`w-4 h-4 ${isSelected ? "opacity-100" : "opacity-35"}`}
                  />
                  <span>{isSelected ? "Selected Plan" : "Choose Plan"}</span>
                </div>
              </button>
            );
          })}
        </div>

        {!playAvailable && (
          <div className="p-3 rounded-2xl bg-muted/60 text-[11px] text-muted-foreground leading-relaxed">
            Google Play In-App Billing completes checkout inside the installed Android app. Outside Android, checkout requests are dispatched to the native wrapper interface.
          </div>
        )}

        {/* Included Features */}
        <div className="space-y-2 py-1 text-xs text-foreground/85">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-primary shrink-0" />
            <span>Unlimited 2D Graphing & Algebraic Equation Solver</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-primary shrink-0" />
            <span>Unlimited Unit & Worldwide Currency Converter</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-primary shrink-0" />
            <span>Unlimited Calculation History & PDF Report Exports</span>
          </div>
        </div>

        {/* Checkout & Restore Actions */}
        <div className="space-y-2.5 pt-1">
          <Button
            onClick={handleBuy}
            disabled={loading || isPro}
            className="w-full min-h-[48px] h-12 rounded-xl font-bold bg-primary hover:bg-primary/90 text-primary-foreground gap-2 cursor-pointer"
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
                {SUBSCRIPTION_TAG} · {selectedPlan.formattedPrice}
                {selectedPlan.id === "premium_monthly" ? "/mo" : "/wk"}
              </>
            )}
          </Button>

          <div className="flex items-center justify-between text-xs text-muted-foreground pt-0.5">
            <button
              type="button"
              onClick={handleRestore}
              disabled={loading}
              className="min-h-[44px] px-1 hover:underline text-muted-foreground hover:text-foreground font-medium cursor-pointer"
            >
              Restore Subscription
            </button>
            <span className="text-[11px] text-muted-foreground">
              Cancel anytime in Google Play
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
