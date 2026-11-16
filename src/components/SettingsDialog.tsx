import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  CreditCard,
  ExternalLink,
  Moon,
  RefreshCw,
  Sun,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import { PLAY_MANAGE_SUBSCRIPTIONS_URL, SUBSCRIPTION_TAG, SubscriptionPlan } from "@/lib/playBilling";
import { getTierDisplayName, SubscriptionStatus } from "@/lib/subscriptionSync";
import {
  getFeatureRemainingTrials,
  getMaxFeatureTrials,
} from "@/lib/trialManager";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isPro: boolean;
  subscriptionStatus: SubscriptionStatus;
  subscriptionTier: string | null;
  subscriptionExpiresAt: string | null;
  plans?: SubscriptionPlan[];
  onOpenPaywall: () => void;
  onRestorePurchases: () => Promise<boolean>;
  zoomPercent: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  dark: boolean;
  onToggleDark: () => void;
}

export const SettingsDialog: React.FC<SettingsDialogProps> = ({
  open,
  onOpenChange,
  isPro,
  subscriptionStatus,
  subscriptionTier,
  subscriptionExpiresAt,
  plans,
  onOpenPaywall,
  onRestorePurchases,
  zoomPercent,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  dark,
  onToggleDark,
}) => {
  const [restoring, setRestoring] = React.useState(false);
  const [restoreFeedback, setRestoreFeedback] = React.useState<string | null>(null);

  const handleRestore = async () => {
    setRestoring(true);
    setRestoreFeedback(null);
    try {
      const ok = await onRestorePurchases();
      setRestoreFeedback(
        ok
          ? "Active subscription verified from Google Play."
          : "No active subscription found on this account."
      );
    } catch {
      setRestoreFeedback("Could not reach Google Play Billing right now.");
    } finally {
      setRestoring(false);
    }
  };

  const handleOpenPlayManage = () => {
    if (typeof window !== "undefined" && window.AndroidBilling?.openSubscriptionManagement) {
      window.AndroidBilling.openSubscriptionManagement();
    }
  };

  const formattedExpiry = subscriptionExpiresAt
    ? new Date(subscriptionExpiresAt).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null;

  const trialRows = [
    { key: "converter", label: "Unit & Currency Converter" },
    { key: "graph", label: "2D Graphing" },
    { key: "equation", label: "Equation Solver" },
    { key: "history", label: "Calculation History" },
    { key: "equation_pdf", label: "Equation PDF Export" },
    { key: "history_pdf", label: "History PDF Export" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-3xl p-6 bg-card border border-border shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">Settings</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Manage your subscription, display zoom, and calculator preferences.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh] pr-3">
          <div className="space-y-6 py-1">
            {/* Manage Subscription Section */}
            <section aria-labelledby="manage-subscription-heading" className="space-y-3">
              <div className="flex items-center justify-between">
                <h3
                  id="manage-subscription-heading"
                  className="text-sm font-bold text-foreground flex items-center gap-2"
                >
                  <CreditCard className="w-4 h-4 text-primary" />
                  Manage Subscription
                </h3>
                <span
                  className={`text-xs font-bold ${
                    isPro ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
                  }`}
                >
                  {isPro
                    ? "Active"
                    : subscriptionStatus === "cancelled"
                      ? "Cancelled"
                      : subscriptionStatus === "expired"
                        ? "Expired"
                        : "Free Plan"}
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-muted/40 space-y-3">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <div className="text-muted-foreground">Current Plan</div>
                    <div className="font-bold text-foreground mt-0.5">
                      {isPro
                        ? (() => {
                            const matched = plans?.find(
                              (p) => p.productId === subscriptionTier || p.id === subscriptionTier
                            );
                            return matched
                              ? `${matched.title} (${matched.formattedPrice})`
                              : getTierDisplayName(subscriptionTier);
                          })()
                        : "Free Tier"}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">
                      {isPro ? "Renews / Expires" : "Access"}
                    </div>
                    <div className="font-semibold text-foreground mt-0.5">
                      {isPro
                        ? formattedExpiry || "Auto-renewing"
                        : "Calculator Free · Trial Tools"}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                  <Button
                    type="button"
                    onClick={() => {
                      onOpenChange(false);
                      onOpenPaywall();
                    }}
                    className="flex-1 min-h-[44px] rounded-xl font-bold gap-2 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4" />
                    {isPro ? "View or Switch Plans" : SUBSCRIPTION_TAG}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleRestore}
                    disabled={restoring}
                    className="min-h-[44px] rounded-xl font-semibold gap-2 cursor-pointer"
                  >
                    <RefreshCw className={`w-4 h-4 ${restoring ? "animate-spin" : ""}`} />
                    Restore
                  </Button>
                </div>

                {restoreFeedback && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span>{restoreFeedback}</span>
                  </p>
                )}

                <div className="pt-2 border-t border-border/60 space-y-2 text-xs text-muted-foreground">
                  <p className="leading-relaxed">
                    Subscriptions are billed through Google Play. To view billing history or cancel auto-renewal at any time, open Google Play Subscriptions:
                  </p>
                  <a
                    href={PLAY_MANAGE_SUBSCRIPTIONS_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={handleOpenPlayManage}
                    className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-xl border border-border bg-card hover:bg-muted text-foreground font-semibold transition w-full sm:w-auto"
                  >
                    <span>Manage or Cancel in Google Play</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            </section>

            {/* Display & Zoom Section */}
            <section className="space-y-3">
              <h3 className="text-sm font-bold text-foreground">Display & Zoom</h3>
              <div className="p-4 rounded-2xl bg-muted/40 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold text-foreground">App Zoom</div>
                    <div className="text-[11px] text-muted-foreground">
                      Adjust text and keypad scale ({zoomPercent}%)
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={onZoomOut}
                      disabled={zoomPercent <= 85}
                      aria-label="Zoom out"
                      className="h-11 w-11 rounded-xl cursor-pointer"
                    >
                      <ZoomOut className="w-4 h-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={onZoomReset}
                      aria-label="Reset zoom"
                      className="h-11 px-3 rounded-xl text-xs font-bold tabular-nums cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5 mr-1" />
                      {zoomPercent}%
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={onZoomIn}
                      disabled={zoomPercent >= 130}
                      aria-label="Zoom in"
                      className="h-11 w-11 rounded-xl cursor-pointer"
                    >
                      <ZoomIn className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border/60">
                  <div>
                    <div className="text-xs font-semibold text-foreground">Theme</div>
                    <div className="text-[11px] text-muted-foreground">
                      {dark ? "Dark mode active" : "Light mode active"}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onToggleDark}
                    className="min-h-[44px] px-4 rounded-xl text-xs font-semibold gap-2 cursor-pointer"
                  >
                    {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                    {dark ? "Switch to Light" : "Switch to Dark"}
                  </Button>
                </div>
              </div>
            </section>

            {/* Free Trials & Always-Free Summary */}
            <section className="space-y-3">
              <h3 className="text-sm font-bold text-foreground">Feature Access</h3>
              <div className="p-4 rounded-2xl bg-muted/40 space-y-2 text-xs">
                <div className="flex items-center justify-between py-1">
                  <span className="font-medium text-foreground">
                    Scientific Calculator & Online/Offline Toggle
                  </span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    Unlimited Free
                  </span>
                </div>
                {trialRows.map((row) => {
                  const max = getMaxFeatureTrials(row.key);
                  const rem = getFeatureRemainingTrials(row.key, isPro);
                  return (
                    <div
                      key={row.key}
                      className="flex items-center justify-between py-1 border-t border-border/50"
                    >
                      <span className="text-muted-foreground">{row.label}</span>
                      <span className="font-semibold text-foreground">
                        {isPro
                          ? "Unlimited"
                          : rem === 0
                          ? `0 / ${max} left`
                          : `${rem} / ${max} free trials left`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>

            <div className="pt-2 border-t border-border/60 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Nume: Scientific Calculator Pro</span>
              <span className="font-semibold">Version 11 (1.0.11)</span>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
