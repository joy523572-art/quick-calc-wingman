import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import Calculator from "@/components/Calculator";
import { GraphingCalculatorView } from "@/components/GraphingCalculatorView";
import { EquationSolverView } from "@/components/EquationSolverView";
import { ConverterView } from "@/components/ConverterView";
import { UpgradeModal } from "@/components/UpgradeModal";
import { usePlayBilling } from "@/hooks/usePlayBilling";
import { requestInAppReview } from "@/lib/inAppReview";
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
  ShieldCheck,
  Star,
  Info,
} from "lucide-react";

type TabKey = "calc" | "graph" | "equations" | "converter";

const STORAGE_THEME = "calc.theme.v1";

const Index = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlTab = searchParams.get("tab") as TabKey | null;

  const [activeTab, setActiveTab] = useState<TabKey>(
    urlTab && ["calc", "graph", "equations", "converter"].includes(urlTab)
      ? urlTab
      : "calc"
  );

  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [featureTrigger, setFeatureTrigger] = useState<string>("");
  const [dark, setDark] = useState(false);

  const { isPro, purchasePlan, checkSubscription } = usePlayBilling();

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

  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  const handleRequestUpgrade = (featureName: string) => {
    setFeatureTrigger(featureName);
    setUpgradeOpen(true);
  };

  const tabs: Array<{ key: TabKey; label: string; icon: React.ReactNode }> = [
    { key: "calc", label: "Calculator", icon: <CalcIcon className="w-4 h-4" /> },
    { key: "graph", label: "Graphing", icon: <LineChart className="w-4 h-4" /> },
    { key: "equations", label: "Solver", icon: <SquareRadical className="w-4 h-4" /> },
    { key: "converter", label: "Converter", icon: <ArrowRightLeft className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground transition-colors duration-200">
      {/* Top Header */}
      <header className="sticky top-0 z-30 w-full border-b border-border/80 bg-background/80 backdrop-blur-md px-4 py-3">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-extrabold tracking-tight">
              Nume<span className="text-primary font-bold ml-1 text-xs px-2 py-0.5 rounded-full bg-primary/10">PRO</span>
            </h1>
          </div>

          <div className="flex items-center gap-2">
            {isPro ? (
              <span className="px-2.5 py-1 rounded-full text-xs font-extrabold bg-primary text-primary-foreground flex items-center gap-1 shadow-xs">
                <Sparkles className="w-3.5 h-3.5" /> PRO ACTIVE
              </span>
            ) : (
              <Button
                size="sm"
                onClick={() => handleRequestUpgrade("Nume Pro")}
                className="h-8 px-3 rounded-xl font-bold bg-primary hover:bg-primary/90 text-primary-foreground text-xs gap-1.5 shadow-xs"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Upgrade</span>
              </Button>
            )}

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-xl"
              onClick={() => setDark((d) => !d)}
              aria-label="Toggle theme"
            >
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Tab Navigation Bar */}
        <div className="max-w-md mx-auto mt-2.5">
          <nav className="grid grid-cols-4 gap-1 p-1 rounded-2xl bg-muted/60 border border-border/60">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => handleTabChange(tab.key)}
                  className={`py-2 px-1 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                    isActive
                      ? "bg-card text-foreground shadow-xs font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab.icon}
                  <span className="truncate">{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main Feature View Container */}
      <main className="flex-1 max-w-md w-full mx-auto p-4 sm:p-5 pb-24">
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

      {/* Bottom Legal & Safety Footer Floating Pill */}
      <footer className="fixed bottom-3 left-1/2 -translate-x-1/2 z-20 rounded-full bg-background/90 backdrop-blur-md border border-border/80 shadow-lg px-3 py-1 flex items-center gap-1.5 text-xs">
        <PolicyDialog
          title="Privacy Policy"
          trigger="Privacy"
          body={<PrivacyPolicy />}
        />
        <span className="text-muted-foreground/40">·</span>
        <PolicyDialog title="About & Subscriptions" trigger="About" body={<About />} />
        <span className="text-muted-foreground/40">·</span>
        <PolicyDialog title="Data Safety" trigger="Data" body={<DataSafety />} />
        <span className="text-muted-foreground/40">·</span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
          onClick={() => void requestInAppReview()}
        >
          <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
          <span>Rate</span>
        </Button>
      </footer>

      {/* Upgrade Paywall Dialog */}
      <UpgradeModal
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        featureTrigger={featureTrigger}
        isPro={isPro}
        onPurchase={purchasePlan}
        onRestore={checkSubscription}
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
          className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground transition rounded-md"
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
      Calculation history and theme preferences are stored locally on your device in your browser's private local storage. This data never leaves your device and can be cleared at any time.
    </p>
    <h3 className="font-semibold text-sm mt-3">Subscriptions & Google Play Billing</h3>
    <p>
      Nume Pro subscriptions ($6/month and $3 weekly) are processed and managed securely through Google Play Digital Goods and Google Play In-App Billing for package <code>scientific.calculator.cm</code>. You can manage or cancel your subscription anytime in your Google Play Account settings.
    </p>
    <h3 className="font-semibold text-sm mt-3">Advertising & Trackers</h3>
    <p>Nume contains zero third-party advertisements, zero trackers, and zero telemetry.</p>
  </>
);

const About = () => (
  <>
    <p>
      <strong>Nume: Scientific Calculator Pro</strong> combines precision scientific arithmetic, 2D graphing, step-by-step linear & quadratic equation solving, and worldwide unit conversions in a single responsive app.
    </p>
    <h3 className="font-semibold text-sm mt-3">Features Included:</h3>
    <ul className="list-disc pl-5 space-y-1">
      <li>Unlimited scientific calculator with trigonometric, logarithmic, and power functions.</li>
      <li>2D Graphing suite with interactive Cartesian coordinates and curve sampling.</li>
      <li>Algebraic linear and quadratic equation solver with full mathematical working.</li>
      <li>Worldwide currency converter and physical unit measurement converter.</li>
      <li>Calculation history with PDF report export.</li>
    </ul>
    <h3 className="font-semibold text-sm mt-3">Google Play Pro Plans:</h3>
    <p>
      <strong>Monthly:</strong> $6.00 / month<br />
      <strong>Weekly:</strong> $3.00 / week
    </p>
    <p className="text-muted-foreground mt-2">
      Manage and cancel anytime via the Google Play Store application under Subscriptions.
    </p>
  </>
);

const DataSafety = () => (
  <>
    <h3 className="font-semibold text-sm">Google Play Data Safety Summary</h3>
    <ul className="list-disc pl-5 space-y-1.5">
      <li><strong>Data collected:</strong> None. Zero personal data collected.</li>
      <li><strong>Data shared:</strong> None. No data shared with third parties or advertisers.</li>
      <li><strong>Security practices:</strong> All data stored strictly on device storage.</li>
      <li><strong>User data deletion:</strong> Full user control over local calculations and cache.</li>
    </ul>
    <h3 className="font-semibold text-sm mt-3">Reset & Clear Local Data</h3>
    <p className="text-muted-foreground">
      Tap below to permanently purge all saved calculation history and cached preferences.
    </p>
    <Button
      variant="destructive"
      size="sm"
      className="mt-2 text-xs rounded-xl"
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
