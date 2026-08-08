import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { PortScene } from "@/components/auth/port-scene";
import { WordmarkInline } from "@/components/brand/wordmark";

// P1 split-screen (ux/03): the form is the screen, the full-height duotone
// port scene is the brand statement — the portal's one cinematic moment. No
// marketing copy panel: everyone here already came to sign in or register.
// The scene drops away below lg.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-[100dvh] lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      {/* Form column: wordmark + create-account link, the working surface,
          legal footer. Identical header at every viewport. */}
      <div className="flex flex-col px-s5 py-s5 sm:px-s7">
        <div className="flex items-center justify-between gap-s4">
          <WordmarkInline />
          <Link
            href="/register"
            className="inline-flex items-center gap-1 rounded-sm text-body-sm font-medium text-text-link hover:underline"
          >
            Create an account
            <ArrowUpRight size={14} aria-hidden />
          </Link>
        </div>

        <main className="flex flex-1 flex-col">
          {/* m-auto centers when there's headroom and collapses to top-aligned
              (scrollable, no clipped heading) when a form is taller than the
              viewport — flex items-center clips overflow at both ends. */}
          <div className="m-auto w-full max-w-sm py-s6 motion-safe:animate-[auth-enter_240ms_cubic-bezier(0.16,1,0.3,1)_both]">
            {children}
          </div>
        </main>

        <footer className="flex flex-wrap items-center justify-between gap-s3 text-caption text-text-tertiary">
          <p>Terminal Ltd · Lagos</p>
          <nav className="flex items-center gap-s4" aria-label="Legal and support">
            <a className="rounded-sm hover:text-text-primary hover:underline" href="mailto:support@terminal.africa">
              Support
            </a>
            <Link className="rounded-sm hover:text-text-primary hover:underline" href="/terms">
              Terms
            </Link>
            <Link className="rounded-sm hover:text-text-primary hover:underline" href="/privacy">
              Privacy
            </Link>
          </nav>
        </footer>
      </div>

      {/* Scene column: full-bleed duotone, captioned. */}
      <div className="relative hidden border-l border-border-default lg:block">
        <PortScene />
        <p className="absolute bottom-s4 left-s4 font-mono text-caption uppercase tracking-[0.12em] text-text-on-chrome/70">
          Apapa Port, Lagos
        </p>
      </div>
    </div>
  );
}
