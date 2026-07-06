import { PortScene } from "@/components/auth/port-scene";
import { WordmarkInline } from "@/components/brand/wordmark";

// P1 split-screen (ux/03): form left, duotone port scene right — the portal's
// one cinematic moment. The scene drops away below lg; the form is the screen.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col px-s5 py-s5 sm:px-s7">
        <WordmarkInline />
        <div className="flex flex-1 items-center">
          <div className="w-full max-w-sm py-s6">{children}</div>
        </div>
        <p className="text-caption text-ink-500">
          Terminal Ltd · Lagos · <a className="underline hover:text-text-primary" href="mailto:support@terminal.africa">support@terminal.africa</a>
        </p>
      </div>
      <div className="hidden lg:block">
        <PortScene />
      </div>
    </div>
  );
}
