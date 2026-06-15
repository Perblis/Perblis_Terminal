import type { Config } from "tailwindcss";
// Generated preset from the shared tokens package — the only source of color,
// type, spacing, and radius for the portal (design.md §5; ch.10). Built by the
// package's `build` script (run via predev/prebuild).
import tokensPreset from "@terminal/tokens/tailwind";

const config: Config = {
  presets: [tokensPreset as Partial<Config>],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: { extend: {} },
  plugins: [],
};

export default config;
