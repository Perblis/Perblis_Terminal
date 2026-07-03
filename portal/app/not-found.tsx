import Link from "next/link";

import { WordmarkInline } from "@/components/brand/wordmark";
import { LostContainerIllustration } from "@/components/ui/system-illustrations";

// P12 · 404
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-s4 px-s5 text-center">
      <WordmarkInline />
      <LostContainerIllustration />
      <h1 className="font-display text-h1 text-text-primary">This page isn&apos;t in the yard</h1>
      <p className="max-w-sm text-body-sm text-text-secondary">
        The address may have moved, or the link was mistyped. Your fleet is where you left it.
      </p>
      <Link
        href="/dashboard"
        className="rounded-sm bg-action-primary px-s5 py-s3 text-body-sm font-medium text-text-on-brand hover:bg-amber-400"
      >
        Back to dashboard
      </Link>
    </main>
  );
}
