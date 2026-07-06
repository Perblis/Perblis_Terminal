import type { Metadata } from "next";

import { WordmarkInline } from "@/components/brand/wordmark";
import { BreakdownIllustration } from "@/components/ui/system-illustrations";

export const metadata: Metadata = { title: "Down for maintenance" };

// P12 · maintenance flag page (middleware rewrites here when MAINTENANCE=1).
export default function MaintenancePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-s4 px-s5 text-center">
      <WordmarkInline />
      <BreakdownIllustration />
      <h1 className="font-display text-h1 text-text-primary">Back shortly</h1>
      <p className="max-w-sm text-body-sm text-text-secondary">
        Terminal is down for planned maintenance. Your listings, hires, and messages are safe —
        check back in a few minutes.
      </p>
    </main>
  );
}
