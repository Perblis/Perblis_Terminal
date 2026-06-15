import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Terminal — Supplier Portal",
  description: "Map-first B2B marketplace for hiring heavy assets in Nigeria.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-paper-50 text-ink-900 font-sans antialiased">{children}</body>
    </html>
  );
}
