// Self-hosted faces per design-system 03 §1 (next/font downloads at build and
// serves from our origin — no runtime Google request). Weights are the spec'd
// set only; anything else is a bundle-size bug.
import { Archivo, IBM_Plex_Mono, Inter } from "next/font/google";

export const display = Archivo({
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

export const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

export const fontVariables = `${display.variable} ${sans.variable} ${mono.variable}`;
