/** Colors/type/spacing come only from @terminal/tokens (design.md §9). */
module.exports = {
  presets: [require("@terminal/tokens/tailwind"), require("nativewind/preset")],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      // RN needs weight-explicit family names (one family per loaded face —
      // lib/fonts.ts). These override the preset's web font stacks.
      fontFamily: {
        display: "Archivo_600SemiBold",
        "display-medium": "Archivo_500Medium",
        "display-bold": "Archivo_700Bold",
        sans: "Inter_400Regular",
        "sans-medium": "Inter_500Medium",
        "sans-semibold": "Inter_600SemiBold",
        mono: "IBMPlexMono_500Medium",
        "mono-regular": "IBMPlexMono_400Regular",
        "mono-semibold": "IBMPlexMono_600SemiBold",
      },
      fontSize: {
        // Money sizes (no fontWeight — weight lives in the family name).
        money: ["18px", { lineHeight: "24px" }],
        // S6's day rate: the headline price on a browsing surface. Between
        // `money` (inline, in lists) and `money-hero` (the one figure you are
        // about to pay, in the request/pay flow) — a 40px rate on a listing
        // reads as a bill rather than a price list.
        "money-md": ["26px", { lineHeight: "32px" }],
        "money-hero": ["40px", { lineHeight: "48px" }],
      },
    },
  },
};
