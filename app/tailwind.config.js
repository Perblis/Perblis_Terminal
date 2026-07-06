/** Colors/type/spacing come only from @terminal/tokens (design.md §9). */
module.exports = {
  presets: [require("@terminal/tokens/tailwind"), require("nativewind/preset")],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
};
