import type { Config } from "tailwindcss";

// TDS-restricted 4 px spacing scale — REPLACES Tailwind's default
// (no 14 / 18 / 28). If you need `p-3.5`, the design is wrong, not the scale.
const tdsSpacing = {
  "0": "0",
  "1": "4px",
  "2": "8px",
  "3": "12px",
  "4": "16px",
  "5": "20px",
  "6": "24px",
  "8": "32px",
  "10": "40px",
  "12": "48px",
  "16": "64px",
  "20": "80px",
  "24": "96px",
};

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    spacing: tdsSpacing,
    borderRadius: {
      none: "0",
      DEFAULT: "4px",
      sm: "4px",
      card: "8px",
      sheet: "12px",
      pill: "9999px",
      full: "9999px",
    },
    extend: {
      colors: {
        abyss: "var(--abyss)",
        surface: "var(--surface)",
        "surface-elevated": "var(--surface-elevated)",
        "surface-high": "var(--surface-high)",
        border: "var(--border)",
        "border-active": "var(--border-active)",

        forge: "var(--forge)",
        "forge-light": "var(--forge-light)",
        "forge-mid": "var(--forge-mid)",
        "forge-dim": "var(--forge-dim)",
        amber: "var(--amber)",
        "amber-dim": "var(--amber-dim)",

        clear: "var(--clear)",
        "clear-soft": "var(--clear-soft)",
        "clear-dim": "var(--clear-dim)",
        signal: "var(--signal)",
        "signal-soft": "var(--signal-soft)",
        "signal-dim": "var(--signal-dim)",
        alert: "var(--alert)",
        "alert-soft": "var(--alert-soft)",
        "alert-dim": "var(--alert-dim)",

        "text-primary": "var(--text-primary)",
        "text-secondary": "var(--text-secondary)",
        "text-tertiary": "var(--text-tertiary)",
        "text-on-accent": "var(--text-on-accent)",
      },
      fontFamily: {
        display: ["var(--font-display)"],
        body: ["var(--font-body)"],
        mono: ["var(--font-mono)"],
      },
      transitionTimingFunction: {
        standard: "cubic-bezier(0.4, 0, 0.2, 1)",
        decelerate: "cubic-bezier(0.2, 0, 0, 1)",
      },
      transitionDuration: {
        fast: "80ms",
        DEFAULT: "200ms",
        sheet: "280ms",
      },
    },
  },
  plugins: [],
};

export default config;
