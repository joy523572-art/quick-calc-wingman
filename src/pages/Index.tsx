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
              Nume<span className="text-primary">.</span>
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
                onClick={() => handleRequestUpgrade("Nume Pro")}
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
            className={`flex items-center justify-center gap-1 py-1.5 px-1.5 rounded-xl text-xs font-semibold transition ${
              activeTab === "graph"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Graph</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("equation")}
            className={`flex items-center justify-center gap-1 py-1.5 px-1.5 rounded-xl text-xs font-semibold transition ${
              activeTab === "equation"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <EqualNot className="w-3.5 h-3.5" />
            <span>Solver</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("converter")}
            className={`flex items-center justify-center gap-1 py-1.5 px-1.5 rounded-xl text-xs font-semibold transition ${
              activeTab === "converter"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>Convert</span>
          </button>
        </nav>

        {/* Active Feature View */}
        <main className="w-full">
          {activeTab === "calc" && (
            <Calculator isPro={isPro} onRequestUpgrade={handleRequestUpgrade} />
          )}
          {activeTab === "graph" && (
            <GraphingCalculatorView isPro={isPro} onRequestUpgrade={handleRequestUpgrade} />
          )}
          {activeTab === "equation" && (
            <EquationSolverView isPro={isPro} onRequestUpgrade={handleRequestUpgrade} />
          )}
          {activeTab === "converter" && (
            <ConverterView isPro={isPro} onRequestUpgrade={handleRequestUpgrade} />
          )}
        </main>
      </div>

      <SubscriptionModal
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        featureName={upgradeFeature}
      />

      {/* Footer / Policy Links */}
      <footer className="mt-auto pt-6 pb-4 flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
        <PolicyDialog title="Privacy Policy" trigger="Privacy" body={<PrivacyPolicy />} />
        <span>•</span>
        <PolicyDialog title="Data Safety & Deletion" trigger="Data Safety" body={<DataSafety />} />
        <span>•</span>
        <PolicyDialog title="About SciCalc Pro" trigger="About" body={<About />} />
        <span>•</span>
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
          <DialogDescription>Last updated: October 2026</DialogDescription>
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
      <strong>Nume: Scientific Calculator Pro</strong> is a scientific calculator and STEM computation suite that respects your privacy.
      We do <strong>not</strong> collect, store, sell, or share any personal information.
    </p>
    <h3 className="font-semibold mt-2">Data Collection & Storage</h3>
    <p>
      All calculations, equation solutions, graphing parameters, and unit conversions run directly on your device.
      Calculation history and UI preferences are stored locally in your browser storage (<code>localStorage</code>)
      and never leave your device.
    </p>
    <h3 className="font-semibold mt-2">Camera & Microphone Permissions</h3>
    <p>
      The app requests access to your camera and microphone only when you explicitly tap Scan or Voice buttons:
    </p>
    <ul className="list-disc pl-5 space-y-1 text-xs">
      <li>
        <strong>Camera:</strong> Used exclusively to perform on-device optical character recognition (OCR) of math expressions. Video frames are analyzed locally and never saved or transmitted.
      </li>
      <li>
        <strong>Microphone:</strong> Used solely for speech recognition of spoken mathematical formulas. Voice input is processed through on-device speech APIs and never recorded or stored.
      </li>
    </ul>
    <h3 className="font-semibold mt-2">Bitmap Memory & Google Play Guidelines</h3>
    <p>
      In accordance with Google Play performance and memory guidelines, camera image frames are strictly downscaled before optical character recognition and immediately released from memory to prevent OutOfMemoryError and battery drain.
    </p>
    <h3 className="font-semibold mt-2">Contact Picker & Location Policy</h3>
    <p>
      In adherence to Google Play's Minimum Permission Policy, Nume does <strong>not</strong> request, access, or require Contact Picker (<code>READ_CONTACTS</code>) or Precise Location (<code>ACCESS_FINE_LOCATION</code>) permissions.
    </p>
    <h3 className="font-semibold mt-2">Subscriptions & Google Play Billing</h3>
    <p>
      Nume Pro subscriptions ($6/monthly and $3 weekly, billed via Google Play) are processed securely through Google Play Digital Goods and Google Play In-App Billing for package <code>scientific.calculator.cm</code>.
      You can manage and cancel your subscriptions at any time in your Google Play Account Settings.
    </p>
    <h3 className="font-semibold mt-2">Third Parties & Advertising</h3>
    <p>Nume contains no third-party advertisements, no behavioral trackers, and no data brokers.</p>
  </>
);

const DataSafety = () => (
  <>
    <h3 className="font-semibold">Data Safety Summary (Google Play Compliant)</h3>
    <ul className="list-disc pl-5 space-y-1 text-xs">
      <li><strong>Data collected:</strong> None. Zero personal data collected.</li>
      <li><strong>Data shared:</strong> None. No data shared with third parties.</li>
      <li><strong>Contacts / Location:</strong> None. No contact picker or location access.</li>
      <li><strong>Bitmap memory:</strong> Downsampled in-memory processing with instant cleanup.</li>
      <li><strong>Security practices:</strong> All data stored locally on device storage.</li>
      <li><strong>User data deletion:</strong> Complete user control over local history and cache.</li>
    </ul>
    <h3 className="font-semibold mt-2">Data Deletion Mechanism</h3>
    <p className="text-xs text-muted-foreground">
      Tap the button below to purge all cached calculations, preferences, and session storage.
    </p>
    <Button
      variant="destructive"
      size="sm"
      className="mt-2 text-xs"
      onClick={() => {
        localStorage.clear();
        sessionStorage.clear();
        window.location.reload();
      }}
    >
      Delete All Local Data & Reset App
    </Button>
  </>
);

const About = () => (
  <>
    <p>
      <strong>Nume: Scientific Calculator Pro</strong> — complete scientific calculator & STEM suite designed for PWA and Google Play:
    </p>
    <ul className="list-disc pl-5 space-y-1 text-xs">
      <li>Unlimited scientific calculator with trig, log, powers, and memory</li>
      <li>Interactive 2D Graphing Calculator with trace coordinates</li>
      <li>Step-by-step linear & quadratic Equation Solver</li>
      <li>Live Currency, Length, Weight, and Temperature Converter</li>
      <li>Camera OCR math scanning & speech voice input</li>
      <li>PDF export and instant clipboard copy</li>
      <li>100% offline-ready PWA with standalone display mode</li>
    </ul>
    <p className="text-muted-foreground text-xs pt-2">
      © 2026 Nume. Compliant with Google Play Store developer policies.
    </p>
  </>
);

export default Index;
