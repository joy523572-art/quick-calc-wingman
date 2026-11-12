import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, Sparkles, Lock, RefreshCw, AlertCircle, ShieldAlert, ShoppingBag } from "lucide-react";
import { isPlayBillingAvailable, resetPlaySubscription } from "@/lib/playBilling";

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  featureTrigger?: string;
  isPro: boolean;
  isBlocked?: boolean;
  onPurchase: (productId?: string, basePlanId?: string) => Promise<boolean>;
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
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleBuy = async () => {
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const ok = await onPurchase("lifetime_premium", "lifetime_premium");
      if (ok) {
        setSuccessMsg("Purchase successful! Lifetime Premium unlocked permanently via Google Play.");
        onSubscriptionResult?.(true, "lifetime_premium");
        setTimeout(() => {
          onOpenChange(false);
        }, 1400);
      } else {
        const msg = "Purchase could not be completed. Please try again.";
        setErrorMsg(msg);
        onSubscriptionResult?.(false, "lifetime_premium", msg);
      }
    } catch (err: unknown) {
      const msg =
        (err as Error)?.message ||
        "Google Play checkout could not be completed. Please check your account and try again.";
      setErrorMsg(msg);
      onSubscriptionResult?.(false, "lifetime_premium", msg);
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
        setSuccessMsg("Lifetime Premium restored successfully from Google Play!");
        onSubscriptionResult?.(true, "lifetime_premium");
        setTimeout(() => onOpenChange(false), 1200);
      } else {
        const msg = "No active lifetime purchase found in Google Play for this account.";
        setErrorMsg(msg);
        onSubscriptionResult?.(false, "Restore", msg);
      }
    } catch {
      const msg = "Google Play purchase verification completed.";
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
              : "Get Unlimited Lifetime Access"}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {isBlocked && !isPro
              ? "You have used your 2 lifetime free trials for this advanced feature. Unlock Lifetime Access ($19.99) via Google Play to use all advanced tools without limits."
              : featureTrigger
              ? `Your free trial uses for ${featureTrigger} are complete. Unlock Lifetime Access ($19.99) via Google Play to keep using all features forever.`
              : "Pay once for $19.99 via Google Play In-App Billing and get unrestricted lifetime access to 2D Graphing, Equation Solver, Converter, and Calculation History."}
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

        {/* Lifetime Managed Product Selection Card */}
        <div className="my-2">
          <div className="p-4 rounded-2xl border border-primary bg-primary/5 ring-1 ring-primary relative flex items-center justify-between">
            <span className="absolute -top-2.5 right-3 px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary text-primary-foreground uppercase tracking-wider">
              Google Play Product
            </span>
            <div>
              <div className="text-xs font-semibold text-muted-foreground">Product ID: lifetime_premium</div>
              <div className="text-2xl font-black text-foreground mt-0.5">$19.99</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">One-time in-app purchase</div>
            </div>
            <div className="text-right text-[11px] font-medium text-primary bg-primary/10 px-2.5 py-1 rounded-lg flex items-center gap-1">
              <ShoppingBag className="w-3.5 h-3.5" /> Google Play
            </div>
          </div>
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
            <span>Unlimited 2D Graphing Calculator</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-primary shrink-0" />
            <span>Step-by-step Linear & Quadratic Solver</span>
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
                Lifetime Access Active
              </>
            ) : loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Processing Purchase...
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                Unlock Lifetime Access ($19.99)
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
              Restore Purchase
            </button>
            <span className="text-[10px] text-muted-foreground">Google Play Billing</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

