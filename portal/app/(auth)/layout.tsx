import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { PortScene } from "@/components/auth/port-scene";
import { WordmarkInline } from "@/components/brand/wordmark";

// P1 split-screen (ux/03): brand/story panel left, form right — the portal's
// one cinematic moment. The scene drops away below lg; the form is the screen.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel: product context + reassurance, hidden below lg. */}
      <div className="hidden lg:flex lg:flex-col lg:justify-between lg:py-s7 lg:pl-s7 lg:pr-s6">
        <WordmarkInline />
        <div className="max-w-md">
          <p className="font-mono text-caption uppercase tracking-[0.12em] text-text-tertiary">
            Terminal · Supplier Portal
          </p>
          <h2 className="mt-s4 font-display text-h1 text-text-primary">
            Run your fleet from one place.
          </h2>
          <p className="mt-s4 text-body text-text-secondary">
            Requests, money, messages and availability — every hire through Terminal is a
            transaction record you can act on.
          </p>
          <ul className="mt-s6 flex flex-col gap-s3">
            {[
              "Verified hirers only",
              "Paystack-secured payouts",
              "Live availability calendar",
            ].map((point) => (
              <li key={point} className="flex items-center gap-s3 text-body-sm text-text-secondary">
                <span aria-hidden className="h-px w-s5 bg-action-primary" />
                {point}
              </li>
            ))}
          </ul>
        </div>
        <div className="relative overflow-hidden rounded-md border border-border-default">
          <div className="aspect-[16/9]">
            <PortScene />
          </div>
          <p className="absolute bottom-s3 left-s3 font-mono text-caption uppercase tracking-[0.12em] text-text-on-chrome/70">
            Apapa Port, Lagos
          </p>
        </div>
      </div>

      {/* Form panel: the working surface. */}
      <div className="flex min-h-screen flex-col px-s5 py-s5 sm:px-s7">
        <div className="flex items-center justify-between lg:justify-end">
          <span className="lg:hidden">
            <WordmarkInline />
          </span>
          <p className="text-body-sm text-text-secondary">
            New to Terminal?{" "}
            <Link
              href="/register"
              className="inline-flex items-center gap-1 font-medium text-text-link hover:underline"
            >
              Create an account
              <ArrowUpRight size={14} aria-hidden />
            </Link>
          </p>
        </div>

        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-sm py-s6">{children}</div>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-s3 text-caption text-text-tertiary">
          <p>Terminal Ltd · Lagos</p>
          <nav className="flex items-center gap-s4" aria-label="Legal and support">
            <a className="hover:text-text-primary hover:underline" href="mailto:support@terminal.africa">
              Support
            </a>
            <Link className="hover:text-text-primary hover:underline" href="/terms">
              Terms
            </Link>
            <Link className="hover:text-text-primary hover:underline" href="/privacy">
              Privacy
            </Link>
          </nav>
        </footer>
      </div>
    </div>
  );
}
