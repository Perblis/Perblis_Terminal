import type { Metadata, Viewport } from "next";

import { PREFERENCES_BOOT_SCRIPT } from "@/components/shell/preferences";

import { fontVariables } from "./fonts";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Terminal — Supplier Portal", template: "%s · Terminal" },
  description: "Run your fleet on Terminal — Nigeria's marketplace for heavy assets.",
};

export const viewport: Viewport = {
  themeColor: "#16181D",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={fontVariables} suppressHydrationWarning>
      <head>
        {/* Stamps the persisted density before first paint — no preference flash. */}
        <script dangerouslySetInnerHTML={{ __html: PREFERENCES_BOOT_SCRIPT }} />
      </head>
      <body className="bg-surface-page font-sans text-body text-text-primary antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
