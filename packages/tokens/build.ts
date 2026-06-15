/**
 * Token build (design-system ch.10 §1).
 *
 * One source (src/*.json) -> platform outputs:
 *   - tailwind.tokens.cjs : Tailwind preset for the portal
 *   - tokens.ts           : typed constants + NativeWind theme for the app
 *   - tokens.css          : CSS custom properties (emails / receipt print)
 *   - admin.css           : thin Ops layer
 *
 * The build also asserts WCAG contrast on the token-pair table (ch.10 §4 /
 * ch.02 §7). A failing pair fails the build — no hex literal ever lives
 * outside primitives.json.
 *
 * Runs on bare Node (>=22, TypeScript stripped at runtime); no dependencies.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const SRC = join(ROOT, "src");

type Json = Record<string, any>;

const primitives: Json = readJson("primitives.json");
const semantic: Json = readJson("semantic.json");
const components: Json = readJson("components.json");

function readJson(name: string): Json {
  return JSON.parse(readFileSync(join(SRC, name), "utf8"));
}

/** Resolve a dotted ref ("color.ink.900" | "space.s4") against primitives. */
function resolveRef(ref: string): string {
  const value = ref
    .split(".")
    .reduce<any>((node, key) => (node == null ? undefined : node[key]), primitives);
  if (typeof value !== "string") {
    throw new Error(`Unresolved token ref: ${ref}`);
  }
  return value;
}

/** Resolve every alias in a semantic map (skips _doc keys). */
function resolveSemantic(map: Json): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, ref] of Object.entries(map)) {
    if (name.startsWith("_")) continue;
    out[name] = resolveRef(ref as string);
  }
  return out;
}

const light = resolveSemantic(semantic.light);
const dark = resolveSemantic(semantic.dark);

// --- Contrast gate (ch.02 §7) -------------------------------------------

function luminance(hex: string): number {
  const n = hex.replace("#", "");
  const channels = [0, 2, 4].map((i) => {
    const c = parseInt(n.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(fg: string, bg: string): number {
  const a = luminance(fg);
  const b = luminance(bg);
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

// [foreground token, background token, min ratio]
const REQUIRED_PAIRS: Array<[string, string, number]> = [
  ["text/primary", "surface/page", 4.5],
  ["text/secondary", "surface/page", 4.5],
  ["text/inverse", "surface/inverse", 4.5],
  ["text/on-brand", "action/primary", 4.5],
  ["text/link", "surface/card", 4.5],
  ["text/danger", "surface/card", 4.5],
];
// Note: border/focus is amber-500 by design (02 §2) — a 2px ring + 1px paper
// gap, not a text/icon pair, so it is intentionally not gated as a ≥3:1
// affordance. The forbidden-pair guard below still bans amber as *text*.

// Pairings that MUST fail AA — encodes "amber text on paper is forbidden"
// (ch.02 §7) so a future edit can't quietly make it a "valid" text pair.
const FORBIDDEN_TEXT_PAIRS: Array<[string, string]> = [["surface/brand", "surface/card"]];

function assertContrast(): void {
  const failures: string[] = [];
  for (const [fg, bg, min] of REQUIRED_PAIRS) {
    const ratio = contrast(light[fg], light[bg]);
    if (ratio < min) {
      failures.push(`${fg} on ${bg}: ${ratio.toFixed(2)}:1 < ${min}:1`);
    }
  }
  // Dark mode: primary text must hold on the dark page.
  const darkRatio = contrast(dark["text/primary"], dark["surface/page"]);
  if (darkRatio < 4.5) {
    failures.push(`[dark] text/primary on surface/page: ${darkRatio.toFixed(2)}:1 < 4.5:1`);
  }
  for (const [fg, bg] of FORBIDDEN_TEXT_PAIRS) {
    const ratio = contrast(light[fg], light[bg]);
    if (ratio >= 4.5) {
      failures.push(`forbidden text pair ${fg} on ${bg} unexpectedly passes AA (${ratio.toFixed(2)}:1)`);
    }
  }
  if (failures.length) {
    console.error("Contrast gate failed:");
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.log(`Contrast gate passed (${REQUIRED_PAIRS.length + 1} pairs).`);
}

// --- Flattening (ch.10 §2: {tier}/{category}/{name} -> flat camelCase) ---

function camel(...parts: string[]): string {
  const words = parts
    .join("/")
    .split(/[/\-_.]/)
    .filter(Boolean);
  return words
    .map((w, i) => (i === 0 ? w : w[0].toUpperCase() + w.slice(1)))
    .join("");
}

function flattenPrimitiveScale(prefix: string, scale: Json): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [ramp, stops] of Object.entries(scale)) {
    for (const [stop, value] of Object.entries(stops as Json)) {
      out[camel(prefix, ramp, stop)] = value as string;
    }
  }
  return out;
}

const flatColors = flattenPrimitiveScale("color", primitives.color);
const flatSpace: Record<string, string> = {};
for (const [k, v] of Object.entries(primitives.space)) flatSpace[camel("space", k)] = v as string;
const flatRadius: Record<string, string> = {};
for (const [k, v] of Object.entries(primitives.radius)) flatRadius[camel("radius", k)] = v as string;
const flatMotion: Record<string, string> = {};
for (const [k, v] of Object.entries(primitives.motion)) flatMotion[k] = v as string;

const flatSemantic: Record<string, string> = {};
for (const [name, value] of Object.entries(light)) flatSemantic[camel("color", name)] = value;

// --- Emit ---------------------------------------------------------------

function cssVarName(token: string): string {
  return "--" + token.replace(/\//g, "-");
}

function emitCss(): void {
  const rootVars = Object.entries(light)
    .map(([t, v]) => `  ${cssVarName(t)}: ${v};`)
    .join("\n");
  const darkVars = Object.entries(dark)
    .map(([t, v]) => `  ${cssVarName(t)}: ${v};`)
    .join("\n");
  const css = `/* Generated by build.ts — do not edit. */\n:root {\n${rootVars}\n}\n\n[data-theme="dark"] {\n${darkVars}\n}\n`;
  writeFileSync(join(ROOT, "tokens.css"), css);

  const admin = `/* Generated by build.ts — thin Ops/admin layer (ch.10 §1). */\n:root {\n  --ops-bg: ${light["surface/page"]};\n  --ops-fg: ${light["text/primary"]};\n  --ops-accent: ${light["action/primary"]};\n  --ops-border: ${light["border/default"]};\n  --ops-mono: ${primitives.type.family.mono};\n}\n`;
  writeFileSync(join(ROOT, "admin.css"), admin);
}

function emitTailwindPreset(): void {
  const colors: Json = {};
  for (const [ramp, stops] of Object.entries(primitives.color)) {
    colors[ramp] = stops;
  }
  // Semantic tokens are wired to CSS vars so dark mode is a remap.
  const semanticColors: Json = {};
  for (const token of Object.keys(light)) {
    const [, ...rest] = token.split("/");
    const group = token.split("/")[0];
    semanticColors[group] = semanticColors[group] || {};
    const leaf = rest.join("-") || "DEFAULT";
    semanticColors[group][leaf] = `var(${cssVarName(token)})`;
  }
  const preset = {
    theme: {
      extend: {
        colors: { ...colors, ...semanticColors },
        spacing: primitives.space,
        borderRadius: primitives.radius,
        fontFamily: {
          sans: primitives.type.family.sans.split(", "),
          mono: primitives.type.family.mono.split(", "),
        },
        fontSize: primitives.type.size,
      },
    },
  };
  const body = `// Generated by build.ts — do not edit. Tailwind preset (portal).\nmodule.exports = ${JSON.stringify(preset, null, 2)};\n`;
  writeFileSync(join(ROOT, "tailwind.tokens.cjs"), body);
}

function emitTokensTs(): void {
  const obj = {
    color: flatColors,
    semantic: flatSemantic,
    space: flatSpace,
    radius: flatRadius,
    motion: flatMotion,
    type: primitives.type,
    components,
    themes: { light, dark },
  };
  const json = JSON.stringify(obj, null, 2);
  const body = `// Generated by build.ts — do not edit. Typed constants + NativeWind theme (app).
export const tokens = ${json} as const;

export type Tokens = typeof tokens;

// NativeWind theme shim: semantic colors for the RN app.
export const nativewindTheme = {
  colors: tokens.themes.light,
  spacing: tokens.space,
} as const;
`;
  writeFileSync(join(ROOT, "tokens.ts"), body);
}

function main(): void {
  mkdirSync(join(ROOT, "glyphs"), { recursive: true });
  assertContrast();
  emitCss();
  emitTailwindPreset();
  emitTokensTs();
  console.log("Tokens built: tailwind.tokens.cjs, tokens.ts, tokens.css, admin.css");
}

main();
