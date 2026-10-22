import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, Check, ShieldCheck, Loader2, CheckCircle2 } from "lucide-react";
import {
  GOOGLE_PLAY_PRODUCTS,
  PRODUCT_ID_MONTHLY,
  PRODUCT_ID_WEEKLY,
  type SubscriptionProductId,
  requestPlayBillingPurchase,
  restorePlayBillingPurchases,
} from "@/lib/playBilling";
import { useSubscription } from "@/hooks/useSubscription";

interface SubscriptionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  featureName?: string;
}

export const SubscriptionModal: React.FC<SubscriptionModalProps> = ({
  open,
  onOpenChange,
  featureName = "Nume Pro",
}) => {
  const { isPro, setIsPro } = useSubscription();
  const [selectedProductId, setSelectedProductId] = useState<SubscriptionProductId>(PRODUCT_ID_MONTHLY);
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const selectedProduct =
    GOOGLE_PLAY_PRODUCTS.find((p) => p.productId === selectedProductId) || GOOGLE_PLAY_PRODUCTS[0];

  const handlePurchase = async () => {
    setLoading(true);
    const result = await requestPlayBillingPurchase(selectedProductId);
    if (result.success) {
      setIsPro(true);
      onOpenChange(false);
    }
    setLoading(false);
  };

  const handleRestore = async () => {
    setRestoring(true);
    const success = await restorePlayBillingPurchases();
    if (success) {
      setIsPro(true);
      onOpenChange(false);
    }
    setRestoring(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-3xl p-6">
        <DialogHeader className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-1">
            <Sparkles className="w-6 h-6" />
          </div>
          <DialogTitle className="text-xl font-bold tracking-tight">
            Unlock {featureName}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Free trial limit reached. Upgrade to unlock all calculator modes, graphing, equation solver, converter, OCR camera scanning, and voice dictation permanently.
          </DialogDescription>
        </DialogHeader>

        {/* Paywall Banner: Price & Billing Period */}
        <div className="p-3 rounded-2xl bg-primary/5 border border-primary/20 text-center space-y-1 my-1">
          <div className="text-xs font-bold text-foreground">
            $6/monthly and $3 weekly. billed via Google play
          </div>
          <p className="text-[11px] text-muted-foreground">
            Choose your preferred plan below. Cancel anytime in Google Play Store settings.
          </p>
        </div>

        {/* Subscription Plan Options */}
        <div className="grid grid-cols-2 gap-2.5 my-2">
          {GOOGLE_PLAY_PRODUCTS.map((prod) => {
            const isSelected = selectedProductId === prod.productId;
            return (
              <button
                key={prod.productId}
                type="button"
                onClick={() => setSelectedProductId(prod.productId)}
                className={`p-3 rounded-2xl border text-left transition relative flex flex-col justify-between ${
                  isSelected
                    ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                    : "border-border bg-muted/40 hover:bg-muted/70"
                }`}
              >
                {prod.popular && (
                  <span className="absolute -top-2.5 right-2 px-2 py-0.5 rounded-full text-[9px] font-bold bg-primary text-primary-foreground shadow-xs">
                    Popular
                  </span>
                )}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-foreground">{prod.title}</span>
                    {isSelected && <CheckCircle2 className="w-4 h-4 text-primary" />}
                  </div>
                  <div className="text-base font-extrabold text-primary">{prod.priceText}</div>
                </div>
                <div className="text-[10px] text-muted-foreground mt-2 border-t border-border/50 pt-1.5">
                  Billed {prod.billingPeriod} via Google Play
                </div>
              </button>
            );
          })}
        </div>

        {/* What's Included */}
        <div className="p-3 rounded-2xl bg-muted/40 border border-border/60 space-y-1.5 text-xs">
          <span className="font-semibold text-[11px] text-muted-foreground block">
            Everything included in Unlimited Access:
          </span>
          <div className="grid grid-cols-1 gap-1 text-[11px]">
            <div className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>Unlimited 2D Graphing Calculator & Trace</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>Step-by-step Linear & Quadratic Equation Solver</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>Currency, Length, Weight & Temp Converter</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>OCR Camera Math Scanning & Voice Dictation</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>PDF Report Export & Unlimited Calculation History</span>
            </div>
          </div>
        </div>

        {/* Action Button: Both product IDs call and use "Get Unlimited Access" */}
        <div className="space-y-2 pt-1">
          <Button
            className="w-full h-12 rounded-xl font-bold text-sm gap-2 shadow-lg shadow-primary/20 bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => void handlePurchase()}
            disabled={loading || isPro}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            {isPro ? "PRO Active" : "Get Unlimited Access"}
          </Button>

          <div className="flex items-center justify-between px-1 text-[11px] text-muted-foreground">
            <span>Selected: {selectedProduct.priceText}</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground"
              onClick={() => void handleRestore()}
              disabled={restoring}
            >
              {restoring ? (
                <Loader2 className="w-3 h-3 animate-spin mr-1" />
              ) : (
                <ShieldCheck className="w-3.5 h-3.5 mr-1" />
              )}
              Restore Google Play Purchase
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
