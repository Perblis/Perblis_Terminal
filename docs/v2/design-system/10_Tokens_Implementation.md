# 10 · Tokens, Implementation & Governance

## 1. Architecture
Three tiers, one source:
```
packages/tokens/
  src/primitives.json     # ramps, type scale, space, radius, motion (raw values)
  src/semantic.json       # aliases → primitives (light + dark maps)
  src/components.json     # component-level tokens (button heights, pin sizes…)
  glyphs/                 # class glyphs, brand T-crane, stamp SVGs
  illustrations/          # 12-piece line library
  map/terminal-chart.json # MapLibre style
  build.ts                # emits all platform outputs
```
Outputs: `tailwind.tokens.cjs` (portal preset) · `tokens.ts` typed constants + NativeWind theme (app) · `tokens.css` custom properties (emails/receipt print) · `admin.css` thin Ops layer. **Rule: no hex literal outside `primitives.json` — CI greps for `#[0-9A-Fa-f]{6}` in mobile/portal code.**

## 2. Naming
`{tier}/{category}/{name}[-{state}]` → exported flat: `colorActionPrimaryHover`, `spaceS4`, `durQuick`. Semantic names never reference hue ("brand" not "amber") so dark mode and future rebrands are remaps, not rewrites. Class/status names use domain words (`classPlant`, `statusOnHire`) — these ARE allowed to be stable forever.

## 3. Platform Mapping
| Layer | Portal (Next.js) | App (Expo RN) |
|---|---|---|
| Tokens | Tailwind preset + CSS vars | tokens.ts + NativeWind theme |
| Components | shadcn/ui restyled via CSS vars + cva variants | bespoke per 05/06 (no UI kit dependency — RN kits fight custom systems) |
| Icons | lucide-react | lucide-react-native |
| Fonts | next/font self-host | expo-font bundle |
| Motion | tailwind transitions + framer-motion (sheets/stamp only) | Reanimated 3 (worklets for sheet/snap), Haptics module |
| Map | maplibre-gl + terminal-chart.json | maplibre-react-native + same style JSON |
Parity contract: 05/06 component specs are the source of truth; platform implementations may differ internally but must match tokens, states, and copy exactly.

## 4. Quality Gates
- **Storybook (portal)** with a11y addon: every core/domain component, all states, light bg + sunlight-sim bg (white @ 1.3 contrast check).
- **App gallery screen** (dev-only route) rendering the same matrix on-device.
- Visual regression: Chromatic free tier (portal) on PR; app manual checklist per release.
- Contrast lint: token-pair table (02 §7) tested in CI (`build.ts` asserts WCAG ratios — a failing pair fails the build).
- Design review checklist per Stage-6 screen: tokens-only colors · states complete (D/H/F/A/L/X/E) · empty/loading/error designed · copy from 09 catalogs · motion from 08 only · one motif max.

## 5. Governance
This system is **founder-governed like DECISIONS.md**: changes to primitives/semantics require a logged decision; component additions need a 05/06 spec entry first, code second. Version: tokens package semver; breaking semantic renames = major. The system serves Stage 6 (screens) — any screen needing an undefined component must add it to the system, not inline it ("no orphan UI" rule).
