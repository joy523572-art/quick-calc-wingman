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
import { Check, Sparkles, Lock, RefreshCw, AlertCircle, Mail, Receipt } from "lucide-react";
import { SUBSCRIPTIONS, isPlayBillingAvailable, getWebSubscriptionRecord, cancelWebSubscription } from "@/lib/playBilling";

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  featureTrigger?: string;
  isPro: boolean;
  onPurchase: (productId: string, basePlanId?: string, email?: string) => Promise<boolean>;
  onRestore: () => Promise<boolean>;
  onSubscriptionResult?: (success: boolean, planId: string, error?: string) => void;
}

export const UpgradeModal: React.FC<UpgradeModalProps> = ({
  open,
  onOpenChange,
  featureTrigger,
  isPro,
  onPurchase,
  onRestore,
  onSubscriptionResult,
}) => {
  const [selectedPlan, setSelectedPlan] = useState<string>("monthly");
  const [email, setEmail] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [receiptDetails, setReceiptDetails] = useState<{ receiptId: string; email: string } | null>(null);

  const webRecord = getWebSubscriptionRecord();

  const handleBuy = async () => {
    if (!isPlayBillingAvailable() && (!email || !email.includes("@"))) {
      setErrorMsg("Please enter your email address to receive your subscription receipt.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    const targetPlan = SUBSCRIPTIONS.find((p) => p.id === selectedPlan) || SUBSCRIPTIONS[0];
    try {
      const ok = await onPurchase(targetPlan.productId, targetPlan.basePlanId, email);
      if (ok) {
        const record = getWebSubscriptionRecord();
        if (record) {
          setReceiptDetails({ receiptId: record.receiptId, email: record.email });
        }
        setSuccessMsg("Subscription successful! All Pro features unlocked.");
        onSubscriptionResult?.(true, targetPlan.id);
        setTimeout(() => {
          onOpenChange(false);
        }, 1600);
      } else {
        const msg = "Subscription could not be completed. Please try again.";
        setErrorMsg(msg);
        onSubscriptionResult?.(false, targetPlan.id, msg);
      }
    } catch (err: unknown) {
      const msg =
        (err as Error)?.message ||
        "Subscription could not be completed. Please check your details and try again.";
      setErrorMsg(msg);
      onSubscriptionResult?.(false, targetPlan.id, msg);
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
        setSuccessMsg("Subscription restored successfully!");
        onSubscriptionResult?.(true, "Restored Plan");
        setTimeout(() => onOpenChange(false), 1200);
      } else {
        const msg = "No active subscription found for this account.";
        setErrorMsg(msg);
        onSubscriptionResult?.(false, "Restore", msg);
      }
    } catch {
      const msg = "Subscription check completed.";
      setErrorMsg(msg);
      onSubscriptionResult?.(false, "Restore", msg);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSub = () => {
    cancelWebSubscription();
    setReceiptDetails(null);
    setSuccessMsg("Subscription cancelled.");
    onRestore();
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
          <div className="p-3.5 rounded-2xl bg-muted/60 dark:bg-muted/40 border border-border/70 text-xs text-muted-foreground flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-primary" />
            <div className="space-y-0.5">
              <span className="font-semibold text-foreground block">Subscription Notice</span>
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
              <Receipt className="w-4 h-4" /> Active Subscription Receipt
            </div>
            <div className="text-foreground/90 font-mono">Receipt ID: {receiptDetails.receiptId}</div>
            <div className="text-muted-foreground">Receipt email sent to: {receiptDetails.email}</div>
          </div>
        )}

        {/* Plan Selection */}
        <div className="grid grid-cols-2 gap-3 my-2">
          {SUBSCRIPTIONS.map((plan) => {
            const isSelected = selectedPlan === plan.id;
            const isBest = plan.id === "monthly" || plan.basePlanId === "monthly-autorenewal";
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
                  {isPlayBillingAvailable() ? "Google Play Billed" : "Instant Web Checkout"}
                </div>
              </div>
            );
          })}
        </div>

        {/* Email input for web checkout receipt */}
        {!isPlayBillingAvailable() && (
          <div className="space-y-1 my-1">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-primary" /> Email Address (for receipt & account sync)
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
                Active Pro Subscription
              </>
            ) : loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Processing Subscription...
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                Get Unlimited Access
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
            {isPro && webRecord ? (
              <button
                type="button"
                onClick={handleCancelSub}
                className="text-destructive hover:underline"
              >
                Cancel Subscription
              </button>
            ) : (
              <span>Instant email receipt upon payment</span>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
