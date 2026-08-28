import { useState } from "react";
import Calculator from "@/components/Calculator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

const Index = () => {
  return (
    <>
      <Calculator />
      <div className="fixed bottom-2 left-1/2 z-20 rounded-full bg-background/80 backdrop-blur px-2 py-1 -translate-x-1/2 flex gap-2 text-xs">
        <PolicyDialog
          title="Privacy Policy"
          trigger="Privacy"
          body={<PrivacyPolicy />}
        />
        <PolicyDialog title="About" trigger="About" body={<About />} />
        <PolicyDialog title="Data & Account" trigger="Data" body={<DataSafety />} />
      </div>
    </>
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
