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
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: { extend: {} },
  plugins: [],
};

export default config;
