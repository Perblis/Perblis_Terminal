// Self-hosted faces per design-system 03 §1 (next/font downloads at build and
// serves from our origin — no runtime Google request). Weights are the spec'd
// set only; anything else is a bundle-size bug.
//
// Faces follow Infisical's frontend: Inter for UI text, JetBrains Mono for
// code/money. Their display face is Alliance No. 2, a commercially-licensed
// typeface we may not redistribute — Inter Tight is the substitute (same
// neo-grotesque skeleton, tighter than Inter at heading sizes).
import { Inter, Inter_Tight, JetBrains_Mono } from "next/font/google";

export const display = Inter_Tight({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

export const sans = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-sans",
  display: "swap",
});

export const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

export const fontVariables = `${display.variable} ${sans.variable} ${mono.variable}`;
