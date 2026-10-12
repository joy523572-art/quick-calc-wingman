import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, Sparkles, AlertCircle, Loader2 } from "lucide-react";
import { SUBSCRIPTIONS } from "@/lib/playBilling";
import { useSubscription } from "@/hooks/useSubscription";

interface SubscriptionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  featureName?: string;
}

export const SubscriptionModal: React.FC<SubscriptionModalProps> = ({
  open,
  onOpenChange,
  featureName,
}) => {
  const { isPro, purchase, restore } = useSubscription();
  const [selectedPlan, setSelectedPlan] = useState<string>("premium_monthly");
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "error" | "info"; text: string } | null>(null);

  const handleSubscribe = async () => {
    setLoading(true);
    setFeedback(null);
    try {
      await purchase(selectedPlan);
      setFeedback({ type: "info", text: "Subscription activated successfully!" });
      setTimeout(() => onOpenChange(false), 1200);
    } catch (err) {
      setFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Purchase could not be completed.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    setFeedback(null);
    try {
      const active = await restore();
      if (active) {
        setFeedback({ type: "info", text: "Subscription restored successfully!" });
        setTimeout(() => onOpenChange(false), 1200);
      } else {
        setFeedback({
          type: "error",
          text: "No active Google Play subscription found for your account.",
        });
      }
    } catch (err) {
      setFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Unable to restore purchases.",
      });
    } finally {
      setRestoring(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-6 bg-card text-card-foreground border border-border shadow-2xl rounded-2xl">
        <DialogHeader className="text-left space-y-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-semibold w-fit mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            SciCalc Pro
          </div>
          <DialogTitle className="text-xl font-bold tracking-tight">
            {featureName ? `Unlock Unlimited ${featureName}` : "Unlock Pro Features"}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Get unlimited access to all advanced mathematical tools and export features.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 my-2">
          {/* Features list */}
          <ul className="space-y-2 text-xs">
            <li className="flex items-center gap-2">
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary">
                <Check className="h-2.5 w-2.5" />
              </span>
              <span><strong>Unlimited History Saves</strong> with timestamp records</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary">
                <Check className="h-2.5 w-2.5" />
              </span>
              <span><strong>Export History to PDF</strong> anytime</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary">
                <Check className="h-2.5 w-2.5" />
              </span>
              <span><strong>Interactive Graphing Calculator</strong> with coordinate tracing</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary">
                <Check className="h-2.5 w-2.5" />
              </span>
              <span><strong>Step-by-Step Equation Solver</strong> (Linear & Quadratic)</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary">
                <Check className="h-2.5 w-2.5" />
              </span>
              <span><strong>Live Currency & Unit Converter</strong> (Length, Weight, Temp)</span>
            </li>
            <li className="flex items-center gap-2 text-muted-foreground">
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Check className="h-2.5 w-2.5" />
              </span>
              <span>Standard scientific calculations always 100% free & unlimited</span>
            </li>
          </ul>

          {/* Pricing Options */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            {SUBSCRIPTIONS.map((plan) => {
              const selected = selectedPlan === plan.id;
              return (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => setSelectedPlan(plan.id)}
                  className={`p-3 rounded-xl border text-left transition-all relative ${
                    selected
                      ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                      : "border-border bg-background hover:bg-muted/50"
                  }`}
                >
                  {plan.id === "premium_monthly" && (
                    <span className="absolute -top-2 right-2 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-primary text-primary-foreground">
                      Best Value
                    </span>
                  )}
                  <div className="text-xs font-semibold text-foreground">{plan.cadence}</div>
                  <div className="text-base font-bold text-foreground mt-0.5">{plan.price}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">Google Play</div>
                </button>
              );
            })}
          </div>

          {feedback && (
            <div
              className={`p-2.5 rounded-lg text-xs flex items-start gap-2 ${
                feedback.type === "error"
                  ? "bg-destructive/10 text-destructive border border-destructive/20"
                  : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
              }`}
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{feedback.text}</span>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-2 pt-1">
            <Button
              className="w-full h-11 text-sm font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={handleSubscribe}
              disabled={loading || restoring || isPro}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Connecting to Google Play...
                </>
              ) : isPro ? (
                "Pro Access Active"
              ) : (
                `Subscribe on Google Play (${SUBSCRIPTIONS.find((p) => p.id === selectedPlan)?.price})`
              )}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs text-muted-foreground hover:text-foreground h-8"
              onClick={handleRestore}
              disabled={loading || restoring}
            >
              {restoring ? "Checking purchases..." : "Restore Google Play Purchases"}
            </Button>
          </div>

          <p className="text-[10px] text-muted-foreground text-center leading-normal">
            Billed through your Google Play account. Subscriptions renew automatically unless cancelled in Google Play Subscriptions at least 24 hours before expiration.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
