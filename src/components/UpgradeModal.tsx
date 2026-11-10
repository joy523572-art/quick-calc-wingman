import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, Sparkles, Lock, RefreshCw, AlertCircle, Mail, Receipt, ShieldAlert } from "lucide-react";
import { isPlayBillingAvailable, getWebSubscriptionRecord, cancelWebSubscription } from "@/lib/playBilling";

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  featureTrigger?: string;
  isPro: boolean;
  isBlocked?: boolean;
  onPurchase: (productId?: string, basePlanId?: string, email?: string) => Promise<boolean>;
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
  const [email, setEmail] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [receiptDetails, setReceiptDetails] = useState<{ receiptId: string; email: string } | null>(null);

  const webRecord = getWebSubscriptionRecord();

  const handleBuy = async () => {
    if (!isPlayBillingAvailable() && (!email || !email.includes("@"))) {
      setErrorMsg("Please enter your email address to receive your purchase receipt.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const ok = await onPurchase("lifetime_premium", "lifetime_premium", email);
      if (ok) {
        const record = getWebSubscriptionRecord();
        if (record) {
          setReceiptDetails({ receiptId: record.receiptId, email: record.email });
        }
        setSuccessMsg("Purchase successful! Lifetime Premium unlocked permanently.");
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
        "Purchase could not be completed. Please check your details and try again.";
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
        const record = getWebSubscriptionRecord();
        if (record) {
          setReceiptDetails({ receiptId: record.receiptId, email: record.email });
        }
        setSuccessMsg("Lifetime Premium restored successfully!");
        onSubscriptionResult?.(true, "lifetime_premium");
        setTimeout(() => onOpenChange(false), 1200);
      } else {
        const msg = "No active lifetime purchase found for this account.";
        setErrorMsg(msg);
        onSubscriptionResult?.(false, "Restore", msg);
      }
    } catch {
      const msg = "Purchase verification completed.";
      setErrorMsg(msg);
      onSubscriptionResult?.(false, "Restore", msg);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSub = () => {
    cancelWebSubscription();
    setReceiptDetails(null);
    setSuccessMsg("Access reset.");
    onRestore();
  };

  const handleOpenChangeInternal = (newOpen: boolean) => {
    onOpenChange(newOpen);
  };

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
              ? "3-Day Free Offer Has Ended"
              : "Get Unlimited Lifetime Access"}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {isBlocked && !isPro
              ? "Your 3-day free offer for Graphing, Equation Solver, and Converter has ended. Unlock Lifetime Access ($19.99) to use all advanced tools, or continue using the scientific calculator freely."
              : featureTrigger
              ? `Unlock ${featureTrigger} and all advanced tools forever.`
              : "Pay once for $19.99 and get unrestricted lifetime access to Graphing, Equation Solver, and Converter."}
          </DialogDescription>
        </DialogHeader>

        {errorMsg && (
          <div className="p-3.5 rounded-2xl bg-destructive/10 border border-destructive/20 text-xs text-destructive flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-destructive" />
            <div className="space-y-0.5">
              <span className="font-semibold block">Notice</span>
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

        {receiptDetails && (
          <div className="p-3.5 rounded-2xl bg-primary/5 border border-primary/20 text-xs space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-primary">
              <Receipt className="w-4 h-4" /> Lifetime Purchase Receipt
            </div>
            <div className="text-foreground/90 font-mono">Receipt ID: {receiptDetails.receiptId}</div>
            <div className="text-muted-foreground">Sent to: {receiptDetails.email}</div>
          </div>
        )}

        {/* Lifetime Managed Product Selection Card */}
        <div className="my-2">
          <div className="p-4 rounded-2xl border border-primary bg-primary/5 ring-1 ring-primary relative flex items-center justify-between">
            <span className="absolute -top-2.5 right-3 px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary text-primary-foreground uppercase tracking-wider">
              One-Time Purchase
            </span>
            <div>
              <div className="text-xs font-semibold text-muted-foreground">Product ID: lifetime_premium</div>
              <div className="text-2xl font-black text-foreground mt-0.5">$19.99</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">Pay once, keep forever</div>
            </div>
            <div className="text-right text-[11px] font-medium text-primary bg-primary/10 px-2.5 py-1 rounded-lg">
              {isPlayBillingAvailable() ? "Google Play In-App" : "Instant Checkout"}
            </div>
          </div>
        </div>

        {/* Email input for web checkout receipt */}
        {!isPlayBillingAvailable() && (
          <div className="space-y-1 my-1">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-primary" /> Email Address (for lifetime receipt)
            </label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="h-10 rounded-xl text-xs"
            />
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
            <span>No recurring subscriptions. Pay once for $19.99.</span>
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
              className="hover:underline text-muted-foreground hover:text-foreground"
            >
              Restore Purchase
            </button>
            {isPro && webRecord ? (
              <button
                type="button"
                onClick={handleCancelSub}
                className="text-destructive hover:underline"
              >
                Reset Storage
              </button>
            ) : (
              <span>Instant receipt upon purchase</span>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
