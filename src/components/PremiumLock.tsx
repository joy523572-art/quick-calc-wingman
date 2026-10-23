import { KeyRound, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

/** Padlock-and-key badge marking a premium (PRO) feature. */
export const PremiumLock = ({ label = "PRO", className }: { label?: string; className?: string }) => (
  <span
    className={cn(
      "inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary",
      className,
    )}
    aria-label="Premium feature"
  >
    <Lock className="h-2.5 w-2.5" />
    <KeyRound className="h-2.5 w-2.5" />
    {label}
  </span>
);
