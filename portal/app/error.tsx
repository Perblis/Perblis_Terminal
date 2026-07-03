"use client";

import { WordmarkInline } from "@/components/brand/wordmark";
import { Button } from "@/components/ui/button";
import { BreakdownIllustration } from "@/components/ui/system-illustrations";

// P12 · 500. The reference is Next's error digest — the same value lands in
// the server logs (and in Sentry once 7E wires it), so support can correlate.
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-s4 px-s5 text-center">
      <WordmarkInline />
      <BreakdownIllustration />
      <h1 className="font-display text-h1 text-text-primary">Something broke on our side</h1>
      <p className="max-w-sm text-body-sm text-text-secondary">
        Nothing you did — the fault is ours and it&apos;s logged. Try again, and if it keeps
        happening, send us the reference below.
      </p>
      {error.digest ? (
        <p className="font-mono text-mono-sm text-ink-500">Ref {error.digest}</p>
      ) : null}
      <div className="flex gap-s3">
        <Button onClick={reset}>Try again</Button>
        <Button variant="secondary" onClick={() => (window.location.href = "/dashboard")}>
          Back to dashboard
        </Button>
      </div>
      <p className="text-caption text-ink-500">
        <a className="underline" href="mailto:support@terminal.africa">
          support@terminal.africa
        </a>
      </p>
    </main>
  );
}
