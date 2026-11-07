import React from "react";
import { CheckCircle2, Info, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export type SubscriptionFeedbackStatus = "success" | "failed" | null;

export interface SubscriptionStatusFeedbackProps {
  status: SubscriptionFeedbackStatus;
  planName?: string;
  errorMessage?: string | null;
  onDismiss: () => void;
  onRetry?: () => void;
}

export const SubscriptionStatusFeedback: React.FC<SubscriptionStatusFeedbackProps> = ({
  status,
  planName,
  errorMessage,
  onDismiss,
  onRetry,
}) => {
  if (!status) return null;

  if (status === "success") {
    return (
      <div
        role="alert"
        aria-live="polite"
        className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 dark:bg-emerald-950/40 p-4 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200"
      >
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-emerald-500/20 p-2 text-emerald-600 dark:text-emerald-400 shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-emerald-800 dark:text-emerald-200">
                Subscription Active & Verified!
              </h4>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5">
                <Sparkles className="w-3 h-3" /> PRO UNLOCKED
              </span>
            </div>
            <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1 leading-relaxed">
              Your {planName ? <strong>{planName}</strong> : "PRO"} subscription has been confirmed by Google Play. All premium features (2D Graphing, Step-by-Step Solver, Full Unit & Currency Converter, and Unlimited History Export) are immediately unlocked!
            </p>
            <div className="mt-3 flex items-center gap-2">
              <Button
                size="sm"
                variant="default"
                onClick={onDismiss}
                className="h-8 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3"
              >
                Start Using PRO Features
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Friendly, non-scary, warm neutral failed/cancelled state
  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-2xl border border-border/80 bg-muted/60 dark:bg-muted/40 p-3.5 shadow-sm animate-in fade-in duration-200"
    >
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-primary/10 p-2 text-primary shrink-0 mt-0.5">
          <Info className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-bold text-foreground">
              Subscription Notice
            </h4>
            <span className="inline-flex items-center rounded-full bg-muted text-muted-foreground text-[10px] font-medium px-2 py-0.5 border border-border/50">
              Incomplete / Cancelled
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            {errorMessage ||
              "The subscription could not be completed or was cancelled. If you already purchased, tap Restore Purchases in the upgrade menu."}
          </p>
          <div className="mt-2.5 flex items-center gap-2">
            {onRetry && (
              <Button
                size="sm"
                variant="outline"
                onClick={onRetry}
                className="h-7 rounded-xl text-xs font-semibold px-3"
              >
                Try Again
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={onDismiss}
              className="h-7 rounded-xl text-xs font-medium px-2 text-muted-foreground hover:text-foreground"
            >
              Dismiss
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionStatusFeedback;
