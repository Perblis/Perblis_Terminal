import type { Metadata } from "next";

import { WordmarkInline } from "@/components/brand/wordmark";
import { GateIllustration } from "@/components/ui/system-illustrations";

export const metadata: Metadata = { title: "Account suspended" };

// P12 · suspended (F12: blocking screen with support contact, no silent
// failures). Deliberately outside the (app) gate — a suspended user can't
// sign in, the login error routes here.
export default function SuspendedPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-s4 px-s5 text-center">
      <WordmarkInline />
      <GateIllustration />
      <h1 className="font-display text-h1 text-text-primary">Your account is suspended</h1>
      <p className="max-w-md text-body-sm text-text-secondary">
        Sign-in is blocked while the suspension stands. If you believe this is wrong, or you want
        to resolve it, talk to us — we answer within one working day.
      </p>
      <a
        href="mailto:support@terminal.africa"
        className="rounded-sm bg-action-primary px-s5 py-s3 text-body-sm font-medium text-text-on-brand hover:bg-amber-400"
      >
        Contact support
      </a>
    </main>
  );
}
