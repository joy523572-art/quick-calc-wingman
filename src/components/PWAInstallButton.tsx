import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { Download, Share } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already running as an installed PWA, hide the button
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <Button
        onClick={() => void install()}
        variant="outline"
        size="sm"
        className="h-8 gap-1.5 text-xs font-medium border-primary/30 text-primary hover:bg-primary/10"
      >
        <Download className="w-3.5 h-3.5" />
        Install App
      </Button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <Button
          onClick={() => setShowIOSGuide(true)}
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs font-medium border-border text-muted-foreground hover:text-foreground"
        >
          <Share className="w-3.5 h-3.5" />
          Install
        </Button>

        <Dialog open={showIOSGuide} onOpenChange={setShowIOSGuide}>
          <DialogContent className="max-w-sm p-5 bg-card text-card-foreground">
            <DialogHeader>
              <DialogTitle className="text-base font-bold">Install on iPhone / iPad</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Follow these simple steps in Safari:
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2 text-xs text-foreground/90">
              <div className="flex items-start gap-2">
                <span className="font-bold bg-muted px-2 py-0.5 rounded">1</span>
                <span>Tap the <strong>Share</strong> button at the bottom of Safari.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-bold bg-muted px-2 py-0.5 rounded">2</span>
                <span>Scroll down and select <strong>Add to Home Screen</strong>.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-bold bg-muted px-2 py-0.5 rounded">3</span>
                <span>Tap <strong>Add</strong> in the top-right corner.</span>
              </div>
            </div>
            <Button
              onClick={() => setShowIOSGuide(false)}
              className="w-full text-xs h-9 mt-2"
            >
              Done
            </Button>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return null;
};
