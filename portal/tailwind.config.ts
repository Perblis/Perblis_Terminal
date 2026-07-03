import type { Config } from "tailwindcss";
// Generated preset from the shared tokens package — the only source of color,
// type, spacing, and radius for the portal (design.md §5; ch.10). Built by the
// package's `build` script (run via predev/prebuild).
import tokensPreset from "@terminal/tokens/tailwind";

const config: Config = {
  // The emitted preset carries fontSize pairs ([size, {lineHeight,...}]) that
  // TS widens to plain arrays, so it no longer structurally overlaps Config —
  // hence the two-step conversion. Shape is guaranteed by the tokens build.
  presets: [tokensPreset as unknown as Partial<Config>],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      // next/font self-hosts the token faces and exposes them as CSS vars;
      // the preset's literal family names remain the fallback stack.
      fontFamily: {
        display: ["var(--font-display)", "Archivo", "system-ui", "sans-serif"],
        sans: ["var(--font-sans)", "Inter", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "'IBM Plex Mono'", "ui-monospace", "monospace"],
      },
      // P1's barely-perceptible pan (wave-7-vision.md) — the one decorative
      // motion, killed by prefers-reduced-motion via motion-safe.
      keyframes: {
        "port-pan": {
          "0%": { transform: "scale(1.06) translateX(0)" },
          "100%": { transform: "scale(1.06) translateX(-2.5%)" },
        },
      },
      animation: {
        "port-pan": "port-pan 60s ease-in-out infinite alternate",
      },
    },
  },
  plugins: [],
};

export default config;
