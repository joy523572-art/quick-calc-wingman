import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import Calculator from "@/components/Calculator";
import { GraphingCalculatorView } from "@/components/GraphingCalculatorView";
import { EquationSolverView } from "@/components/EquationSolverView";
import { ConverterView } from "@/components/ConverterView";
import { UpgradeModal } from "@/components/UpgradeModal";
import { SettingsDialog } from "@/components/SettingsDialog";
import { useSubscription } from "@/hooks/usePlayBilling";
import { resetPlaySubscription, SUBSCRIPTION_TAG } from "@/lib/playBilling";
import { requestInAppReview } from "@/lib/inAppReview";
import { useNetworkMode } from "@/lib/networkMode";
import {
  hasFeatureFreeTrials,
  resetAllFeatureTrials,
  exhaustAllFeatureTrials,
  isAppPermanentlyBlocked,
} from "@/lib/trialManager";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Calculator as CalcIcon,
  LineChart,
  SquareRadical,
  ArrowRightLeft,
  Sparkles,
  Sun,
  Moon,
  Star,
  Wifi,
  WifiOff,
  Lock,
  Settings,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

type TabKey = "calc" | "graph" | "equations" | "converter";

const tabToFeatureKey = (tab: TabKey): string =>
  tab === "equations" ? "equation" : tab;

const STORAGE_THEME = "calc.theme.v1";
const STORAGE_ZOOM = "calc.zoom.v1";
const MIN_ZOOM = 80;
const MAX_ZOOM = 130;
const ZOOM_STEP = 10;

const Index = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlTab = searchParams.get("tab") as TabKey | null;

  const [activeTab, setActiveTab] = useState<TabKey>(
    urlTab && ["calc", "graph", "equations", "converter"].includes(urlTab)
      ? urlTab
      : "calc"
  );

  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [featureTrigger, setFeatureTrigger] = useState<string>("");
  const [dark, setDark] = useState(false);
  const [zoomPercent, setZoomPercent] = useState<number>(() => {
    try {
      const saved = Number(localStorage.getItem(STORAGE_ZOOM));
      if (!isNaN(saved) && saved >= MIN_ZOOM && saved <= MAX_ZOOM) {
        return saved;
      }
    } catch {
      // ignore storage access issues
    }
    return 100;
  });
  const [, setTrialTick] = useState(0);

  const {
    isPro,
    subscriptionStatus,
    subscriptionTier,
    subscriptionExpiresAt,
    purchasePlan,
    checkSubscription,
    plans,
  } = useSubscription();
  const network = useNetworkMode();

  // Listen for feature trial use events to re-render tab lock badges live
  useEffect(() => {
    const handleTrialUsed = () => setTrialTick((t) => t + 1);
    window.addEventListener("nume:feature-trial-used", handleTrialUsed);
    return () => window.removeEventListener("nume:feature-trial-used", handleTrialUsed);
  }, []);

  const isBlocked = isAppPermanentlyBlocked(isPro);

  // Dark/Light theme setup
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_THEME);
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = stored ? stored === "dark" : prefersDark;
    setDark(isDark);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem(STORAGE_THEME, dark ? "dark" : "light");
  }, [dark]);

  // Apply root zoom level cleanly across the app
  useEffect(() => {
    document.documentElement.style.fontSize = `${zoomPercent}%`;
    try {
      localStorage.setItem(STORAGE_ZOOM, String(zoomPercent));
    } catch {
      // ignore
    }
  }, [zoomPercent]);

  const handleZoomIn = () =>
    setZoomPercent((z) => Math.min(MAX_ZOOM, z + ZOOM_STEP));
  const handleZoomOut = () =>
    setZoomPercent((z) => Math.max(MIN_ZOOM, z - ZOOM_STEP));
  const handleZoomReset = () => setZoomPercent(100);

  const handleRequestUpgrade = (featureName: string) => {
    setFeatureTrigger(featureName);
    setUpgradeOpen(true);
  };

  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab);
    setSearchParams({ tab });
    // Redirect unsubscribed users to the paywall when clicking on an exhausted trial feature
    if (tab !== "calc" && !hasFeatureFreeTrials(tabToFeatureKey(tab), isPro) && !isPro) {
      handleRequestUpgrade(
        tab === "graph"
          ? "2D Graphing Calculator"
          : tab === "equations"
          ? "Equation Solver"
          : "Unit & Currency Converter"
      );
    }
  };

  // If user opens app directly on an exhausted premium tab, prompt paywall modal
  useEffect(() => {
    if (activeTab !== "calc" && !hasFeatureFreeTrials(tabToFeatureKey(activeTab), isPro) && !isPro) {
      handleRequestUpgrade(
        activeTab === "graph"
          ? "2D Graphing Calculator"
          : activeTab === "equations"
          ? "Equation Solver"
          : "Unit & Currency Converter"
      );
    }
  }, [activeTab, isPro]);

  const tabs: Array<{ key: TabKey; label: string; icon: React.ReactNode; isPremiumTool?: boolean }> = [
    { key: "calc", label: "Calculator", icon: <CalcIcon className="w-4 h-4" /> },
    { key: "graph", label: "Graphing", icon: <LineChart className="w-4 h-4" />, isPremiumTool: true },
    { key: "equations", label: "Solver", icon: <SquareRadical className="w-4 h-4" />, isPremiumTool: true },
    { key: "converter", label: "Converter", icon: <ArrowRightLeft className="w-4 h-4" />, isPremiumTool: true },
  ];

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground transition-colors duration-200">
      {/* Top Header */}
      <header className="sticky top-0 z-30 w-full border-b border-border/80 bg-background/85 backdrop-blur-md px-3 sm:px-4 py-2.5">
        <div className="max-w-md mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="text-base font-extrabold tracking-tight truncate">
              Nume
            </h1>
            {isPro ? (
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-primary">
                PRO
              </span>
            ) : (
              <button
                type="button"
                onClick={() => handleRequestUpgrade("")}
                className="min-h-[36px] px-3 py-1.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-extrabold tracking-tight shadow-xs truncate cursor-pointer flex items-center gap-1.5 transition active:scale-95"
              >
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                <span>{isBlocked ? "Subscribe" : "Unlock"}</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-1">
            {/* Zoom In / Out Controls */}
            <div
              className="flex items-center rounded-xl border border-border bg-card/60"
              role="group"
              aria-label="App zoom controls"
            >
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-8 rounded-l-xl rounded-r-none cursor-pointer"
                onClick={handleZoomOut}
                disabled={zoomPercent <= MIN_ZOOM}
                aria-label="Zoom out"
                title="Zoom out"
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </Button>
              <button
                type="button"
                onClick={handleZoomReset}
                aria-label={`Current zoom ${zoomPercent} percent. Click to reset`}
                title="Click to reset zoom to 100%"
                className="h-9 px-1.5 text-[11px] font-bold tabular-nums text-muted-foreground hover:text-foreground cursor-pointer"
              >
                {zoomPercent}%
              </button>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-8 rounded-r-xl rounded-l-none cursor-pointer"
                onClick={handleZoomIn}
                disabled={zoomPercent >= MAX_ZOOM}
                aria-label="Zoom in"
                title="Zoom in"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </Button>
            </div>

            {/* Online / Offline Toggle (Permanently Unlocked) */}
            <Button
              variant="outline"
              size="sm"
              className="h-9 px-2.5 rounded-xl text-[11px] font-semibold gap-1.5 cursor-pointer"
              onClick={() => network.setPreference(network.preference === "online" ? "offline" : "online")}
              aria-label={network.online ? "Online mode on. Switch to offline" : "Offline mode on. Switch to online"}
              title={!network.deviceOnline ? "No internet connection — working offline" : network.online ? "Switch to Offline mode" : "Switch to Online mode"}
            >
              {network.online ? (
                <Wifi className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              ) : (
                <WifiOff className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              )}
              <span className="inline">{network.online ? "Online" : "Offline"}</span>
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-xl cursor-pointer"
              onClick={() => setDark((d) => !d)}
              aria-label="Toggle theme"
              title="Toggle light/dark theme"
            >
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-xl cursor-pointer"
              onClick={() => setSettingsOpen(true)}
              aria-label="Settings and Manage Subscription"
              title="Settings"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Tab Navigation Bar */}
        <div className="max-w-md mx-auto mt-2">
          <nav className="grid grid-cols-4 gap-1 p-1 rounded-2xl bg-muted/60 border border-border/60">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => handleTabChange(tab.key)}
                  className={`min-h-[40px] py-2 px-1 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition cursor-pointer ${
                    isActive
                      ? "bg-card text-foreground shadow-xs font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab.icon}
                  <span className="truncate">{tab.label}</span>
                  {tab.isPremiumTool && !hasFeatureFreeTrials(tabToFeatureKey(tab.key), isPro) && !isPro && (
                    <Lock className="w-2.5 h-2.5 opacity-80 text-amber-500 shrink-0" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main Feature View Container */}
      <main className={`flex-1 w-full mx-auto p-4 sm:p-5 pb-20 ${activeTab === "equations" ? "max-w-3xl" : "max-w-md"}`}>
        {activeTab === "calc" && (
          <Calculator isPro={isPro} onRequestUpgrade={handleRequestUpgrade} />
        )}
        {activeTab === "graph" && (
          <GraphingCalculatorView isPro={isPro} onRequestUpgrade={handleRequestUpgrade} />
        )}
        {activeTab === "equations" && (
          <EquationSolverView isPro={isPro} onRequestUpgrade={handleRequestUpgrade} />
        )}
        {activeTab === "converter" && (
          <ConverterView isPro={isPro} onRequestUpgrade={handleRequestUpgrade} />
        )}
      </main>

      {/* Bottom Legal & Settings Bar */}
      <footer className="w-full border-t border-border/60 bg-background/85 backdrop-blur-md py-2 px-4 mt-auto">
        <div className="max-w-md mx-auto flex items-center justify-center gap-2 text-xs">
          <PolicyDialog title="Privacy Policy" trigger="Privacy" body={<PrivacyPolicy />} />
          <span className="text-muted-foreground/40">·</span>
          <PolicyDialog title="About & Licensing" trigger="About" body={<About />} />
          <span className="text-muted-foreground/40">·</span>
          <PolicyDialog title="Data Safety" trigger="Data" body={<DataSafety />} />
          <span className="text-muted-foreground/40">·</span>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground transition rounded-md cursor-pointer"
          >
            Settings
          </button>
          <span className="text-muted-foreground/40">·</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground gap-1 cursor-pointer"
            onClick={() => void requestInAppReview()}
          >
            <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
            <span>Rate</span>
          </Button>
        </div>
      </footer>

      {/* Subscription Paywall Dialog */}
      <UpgradeModal
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        featureTrigger={featureTrigger}
        isPro={isPro}
        isBlocked={isBlocked}
        plans={plans}
        onPurchase={purchasePlan}
        onRestore={checkSubscription}
      />

      {/* Settings Dialog with Manage Subscription & Zoom Controls */}
      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        isPro={isPro}
        plans={plans}
        subscriptionStatus={subscriptionStatus}
        subscriptionTier={subscriptionTier}
        subscriptionExpiresAt={subscriptionExpiresAt}
        onOpenPaywall={() => handleRequestUpgrade("")}
        onRestorePurchases={checkSubscription}
        zoomPercent={zoomPercent}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onZoomReset={handleZoomReset}
        dark={dark}
        onToggleDark={() => setDark((d) => !d)}
      />
    </div>
  );
};

const PolicyDialog = ({
  title,
  trigger,
  body,
}: {
  title: string;
  trigger: string;
  body: React.ReactNode;
}) => {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground transition rounded-md cursor-pointer"
        >
          {trigger}
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-lg rounded-3xl p-6 bg-card border border-border">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Nume: Scientific Calculator Pro</DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="text-xs text-foreground/90 space-y-3 leading-relaxed">
            {body}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

const PrivacyPolicy = () => (
  <>
    <p>
      <strong>Nume: Scientific Calculator Pro</strong> is a privacy-first scientific calculator designed to deliver powerful offline mathematical computing. We do <strong>not</strong> collect, store, sell, or share any personal information.
    </p>
    <h3 className="font-semibold text-sm mt-3">Zero Permissions</h3>
    <p>
      In accordance with Google Play's Minimum Permission Policy, Nume does not request Contact Picker (<code>READ_CONTACTS</code>) or Precise Location (<code>ACCESS_FINE_LOCATION</code>).
    </p>
    <h3 className="font-semibold text-sm mt-3">Local Device Storage</h3>
    <p>
      Calculation history, zoom scale, and theme preferences are stored locally on your device in your browser's private local storage.
    </p>
    <h3 className="font-semibold text-sm mt-3">Subscriptions & Google Play Billing</h3>
    <p>
      Nume offers <strong>Monthly Subscription</strong> (Product ID: <code>premium_monthly</code>, Base Plan: <code>monthly-autorewal</code>) and <strong>Weekly Subscription</strong> (Product ID: <code>premium_weekly</code>, Base Plan: <code>weekly-autorenewal</code>) processed through Google Play In-App Billing for package <code>scientific.calculator.cm</code>.
    </p>
    <h3 className="font-semibold text-sm mt-3">Advertising & Trackers</h3>
    <p>Nume contains zero third-party advertisements, zero trackers, and zero telemetry.</p>
  </>
);

const About = () => (
  <>
    <p>
      <strong>Nume: Scientific Calculator Pro</strong> combines precision scientific arithmetic, 2D graphing, step-by-step linear & quadratic equation solving, and worldwide unit conversions.
    </p>
    <h3 className="font-semibold text-sm mt-3">Features Included:</h3>
    <ul className="list-disc pl-5 space-y-1">
      <li>Unlimited free scientific calculator and Online/Offline mode toggle.</li>
      <li>2D Graphing suite (3 free lifetime trials, unlimited with subscription).</li>
      <li>Algebraic equation solver (3 free lifetime trials, unlimited with subscription).</li>
      <li>Worldwide currency and unit converter (4 free lifetime trials, unlimited with subscription).</li>
      <li>Calculation history and PDF report export (3 free lifetime trials, unlimited with subscription).</li>
    </ul>
    <h3 className="font-semibold text-sm mt-3">Subscription Plans:</h3>
    <p>
      <strong>Monthly Subscription:</strong> <code>premium_monthly</code> (<code>monthly-autorewal</code>)<br />
      <strong>Weekly Subscription:</strong> <code>premium_weekly</code> (<code>weekly-autorenewal</code>)
    </p>
    <p className="text-muted-foreground pt-2">
      App Version: <strong>Version 11 (1.0.11)</strong>
    </p>
  </>
);

const DataSafety = () => (
  <>
    <h3 className="font-semibold text-sm">Google Play Data Safety Summary</h3>
    <ul className="list-disc pl-5 space-y-1.5">
      <li><strong>Data collected:</strong> None beyond account subscription status if signed in.</li>
      <li><strong>Data shared:</strong> None. No data shared with third parties.</li>
      <li><strong>Security practices:</strong> Calculations stored strictly on device storage.</li>
    </ul>
    <h3 className="font-semibold text-sm mt-3">Trial Testing & Reset</h3>
    <p className="text-muted-foreground">
      Test the paywall lock (4 free trials for Converter, 3 free trials for other tools) or restore trials:
    </p>
    <div className="flex flex-wrap gap-2 mt-2">
      <Button
        variant="outline"
        size="sm"
        className="text-xs rounded-xl border-amber-500/50 text-amber-600 dark:text-amber-400 font-bold hover:bg-amber-500/10 cursor-pointer"
        onClick={() => {
          exhaustAllFeatureTrials();
          resetPlaySubscription(false);
          window.location.reload();
        }}
      >
        Exhaust Free Trials (Lock Features)
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="text-xs rounded-xl cursor-pointer"
        onClick={() => {
          resetAllFeatureTrials();
          resetPlaySubscription(false);
          window.location.reload();
        }}
      >
        Reset Free Trials
      </Button>
    </div>

    <h3 className="font-semibold text-sm mt-4">Reset & Clear Local Data</h3>
    <p className="text-muted-foreground">
      Tap below to permanently purge saved calculation history and cached preferences.
    </p>
    <Button
      variant="destructive"
      size="sm"
      className="mt-2 text-xs rounded-xl cursor-pointer"
      onClick={() => {
        localStorage.clear();
        sessionStorage.clear();
        window.location.reload();
      }}
    >
      Delete All Local Data
    </Button>
  </>
);

export default Index;
