import { useState, useEffect } from "react";
import Calculator from "@/components/Calculator";
import { GraphingCalculatorView } from "@/components/GraphingCalculatorView";
import { EquationSolverView } from "@/components/EquationSolverView";
import { ConverterView } from "@/components/ConverterView";
import { SubscriptionModal } from "@/components/SubscriptionModal";
import { PWAInstallButton } from "@/components/PWAInstallButton";
import { useSubscription } from "@/hooks/useSubscription";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { requestInAppReview } from "@/lib/inAppReview";
import {
  Calculator as CalcIcon,
  TrendingUp,
  EqualNot,
  ArrowRightLeft,
  Sparkles,
  Sun,
  Moon,
  Lock,
} from "lucide-react";

type ActiveTab = "calc" | "graph" | "equation" | "converter";

const STORAGE_THEME = "calc.theme.v1";

const Index = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>("calc");
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeFeature, setUpgradeFeature] = useState<string>("SciCalc Pro");
  const { isPro } = useSubscription();
  const [dark, setDark] = useState(false);

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

  const handleRequestUpgrade = (featureName: string) => {
    setUpgradeFeature(featureName);
    setUpgradeOpen(true);
  };

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-start p-3 sm:p-5 pb-20">
      <div className="w-full max-w-md mx-auto space-y-3">
        {/* Header Bar */}
        <header className="flex items-center justify-between px-1 pt-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight">
              Sci<span className="text-primary">Calc</span>
            </h1>
            {isPro ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                PRO ACTIVE
              </span>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="h-6 px-2 text-[11px] font-semibold gap-1 border-primary/30 text-primary hover:bg-primary/10 rounded-full"
                onClick={() => handleRequestUpgrade("SciCalc Pro")}
              >
                <Sparkles className="w-3 h-3 text-primary" />
                Go PRO
              </Button>
            )}
          </div>

          <div className="flex items-center gap-1">
            <PWAInstallButton />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setDark((d) => !d)}
              aria-label="Toggle theme"
            >
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
        </header>

        {/* Feature Mode Switcher */}
        <nav aria-label="Calculator Modes" className="grid grid-cols-4 gap-1 p-1 bg-muted/80 backdrop-blur rounded-2xl border border-border">
          <button
            type="button"
            onClick={() => setActiveTab("calc")}
            className={`flex items-center justify-center gap-1 py-1.5 px-1.5 rounded-xl text-xs font-semibold transition ${
              activeTab === "calc"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <CalcIcon className="w-3.5 h-3.5" />
            <span>Calc</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("graph")}
            className={`flex items-center justify-center gap-1 py-1.5 px-1.5 rounded-xl text-xs font-semibold transition relative ${
              activeTab === "graph"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Graph</span>
            {!isPro && <Lock className="w-2.5 h-2.5 text-muted-foreground/70" />}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("equation")}
            className={`flex items-center justify-center gap-1 py-1.5 px-1.5 rounded-xl text-xs font-semibold transition relative ${
              activeTab === "equation"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <EqualNot className="w-3.5 h-3.5" />
            <span>Solver</span>
            {!isPro && <Lock className="w-2.5 h-2.5 text-muted-foreground/70" />}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("converter")}
            className={`flex items-center justify-center gap-1 py-1.5 px-1.5 rounded-xl text-xs font-semibold transition relative ${
              activeTab === "converter"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>Convert</span>
            {!isPro && <Lock className="w-2.5 h-2.5 text-muted-foreground/70" />}
          </button>
        </nav>

        {/* Selected Tool View */}
        <main className="w-full">
          {activeTab === "calc" && (
            <Calculator
              isPro={isPro}
              onRequestUpgrade={handleRequestUpgrade}
              hideHeader
            />
          )}

          {activeTab === "graph" && (
            <GraphingCalculatorView
              isPro={isPro}
              onRequestUpgrade={handleRequestUpgrade}
            />
          )}

          {activeTab === "equation" && (
            <EquationSolverView
              isPro={isPro}
              onRequestUpgrade={handleRequestUpgrade}
            />
          )}

          {activeTab === "converter" && (
            <ConverterView
              isPro={isPro}
              onRequestUpgrade={handleRequestUpgrade}
            />
          )}
        </main>
      </div>

      {/* Subscription Paywall Modal */}
      <SubscriptionModal
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        featureName={upgradeFeature}
      />

      {/* Bottom Sticky Policies / Rate Bar */}
      <footer className="fixed bottom-2 left-1/2 z-20 rounded-full bg-background/80 backdrop-blur px-2 py-1 -translate-x-1/2 flex gap-2 text-xs border border-border/50 shadow-md">
        <PolicyDialog
          title="Privacy Policy"
          trigger="Privacy"
          body={<PrivacyPolicy />}
        />
        <PolicyDialog title="About" trigger="About" body={<About />} />
        <PolicyDialog title="Data & Account" trigger="Data" body={<DataSafety />} />
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-muted-foreground"
          onClick={() => void requestInAppReview()}
        >
          Rate
        </Button>
      </footer>
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
        <Button variant="ghost" size="sm" className="h-7 px-2 text-muted-foreground">
          {trigger}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Last updated: May 2026</DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="text-sm text-foreground/90 space-y-3 leading-relaxed">
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
      <strong>SciCalc</strong> is a scientific calculator app that respects your
      privacy. We do <strong>not</strong> collect, store, or share any personal
      information.
    </p>
    <h3 className="font-semibold mt-2">Data We Collect</h3>
    <p>None. The app runs entirely on your device.</p>
    <h3 className="font-semibold mt-2">Local Storage</h3>
    <p>
      Your calculation history and theme preference are stored locally in your
      browser using <code>localStorage</code>. This data never leaves your
      device. You can clear it anytime from the History panel.
    </p>
    <h3 className="font-semibold mt-2">Permissions</h3>
    <p>
      The app requests no sensitive permissions (no camera, microphone,
      contacts, location, SMS, photos, or storage access).
    </p>
    <h3 className="font-semibold mt-2">Third Parties</h3>
    <p>No analytics, no ads, no trackers, no third-party SDKs.</p>
    <h3 className="font-semibold mt-2">Children</h3>
    <p>Suitable for all ages. No data collection means it is safe for children.</p>
    <h3 className="font-semibold mt-2">Contact</h3>
    <p>Questions? Email: support@scicalc.app</p>
  </>
);

const DataSafety = () => (
  <>
    <h3 className="font-semibold">Data Safety Summary</h3>
    <ul className="list-disc pl-5 space-y-1">
      <li>No personal data collected.</li>
      <li>No data shared with third parties.</li>
      <li>No account required to use the app.</li>
      <li>History stored only on your device.</li>
    </ul>
    <h3 className="font-semibold mt-2">Account Deletion</h3>
    <p>
      No account exists. To remove all locally stored data (history & settings),
      tap the button below.
    </p>
    <Button
      variant="destructive"
      size="sm"
      onClick={() => {
        localStorage.clear();
        window.location.reload();
      }}
    >
      Delete all local data
    </Button>
  </>
);

const About = () => (
  <>
    <p>
      <strong>SciCalc</strong> — a complete scientific calculator with
      trigonometry, logarithms, exponents, factorials, memory functions, and
      history.
    </p>
    <ul className="list-disc pl-5 space-y-1">
      <li>Works fully offline</li>
      <li>Light & dark mode</li>
      <li>Keyboard support</li>
      <li>Radian / Degree modes</li>
      <li>No ads, no tracking</li>
    </ul>
    <p className="text-muted-foreground">
      © 2026 SciCalc. Built with care for accuracy and clarity.
    </p>
  </>
);

export default Index;
