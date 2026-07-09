# Wave 8 Vision — Hirer App look & feel (founder session, 2026-07-06)

**Status:** binding for Wave 8. Additive to [wave-8.md](wave-8.md), which stays normative for scope, slices, and the exit criterion. Where this document is silent, the design-system chapters (`docs/v2/design-system/`) and `ux/02` govern. Captured from a founder elicitation session (20 questions, 5 batches) run before slice 8A, per the founder's "vision session first" call.

## North star

- **Benchmark: consumer-app polish + map-product identity.** The app should feel as warm and approachable as best-in-class consumer apps (Airbnb/Uber energy) *and* wear the map as its brand — great map-first products (Citymapper, Flighty) are the reference. The industrial Heavy Duty edge survives in accents, not in density.
- **Acid test (two-part):** every screen holds the Wave 7 screenshot-proud bar, **and** leads with trust — verification ticks, locked terms, receipts, and masking explainers are design features, not chrome. A hirer moving ₦-millions should feel the rails.
- **Speed remains the substrate:** nothing in this vision may cost the J2 <10-minute clock or the <4s cold start.

## Binding decisions

| # | Area | Decision |
|---|---|---|
| V1 | Theme | **Light + dark from day one**, following the system setting. Both palettes run through the full 7-state matrix on every screen. (Tokens' `nativewindTheme` export gains a dark palette in 8A.) |
| V2 | Money | Portal rules hold (IBM Plex Mono, full value, server `*_display` strings verbatim) but the total is **scaled up as the dominant element** on request review, pay, and receipt. |
| V3 | Onboarding art | **Live map tease** — the three onboarding screens float over a blurred/animated Terminal Chart of Lagos with real pins. Sell the product, not a metaphor. |
| V4 | Map style | **Full custom "Terminal Chart" style JSON, committed to `packages/tokens/map`, in both themes, this wave (8B).** Closes the Wave 7E carry-over; the portal adopts the same JSON afterwards. To be ratified as **D-022** in DECISIONS.md when it lands. |
| V5 | Pin feel | **Springy & alive + chart-instrument.** Pins drop with spring physics; the peek card slides with momentum; locate-me is a radar-sweep pulse; selection draws a crosshair ring; mono coordinates as instrument detail. A light haptic tick on pin select is part of the map instrument (an explicit exception to V8). Anatomy stays normative per 06 §3. |
| V6 | App icon / splash | **T-crane glyph, amber on ink-900** (`packages/tokens/glyphs/brand/t-crane.svg`) — consistent with the portal favicon. |
| V7 | Signature moments | **All four get full ceremony:** ① PAID stamp (08 §4, normative) ② Confirmed handshake beat when the supplier accepts ③ handover both-ticks settle ④ first-launch map reveal (chart fades up, pins stagger in — first launch only). Reduced-motion renders final states instantly (08 §6). |
| V8 | Haptics | **Moments only:** the four signature moments + destructive confirms (+ the V5 pin tick). No ambient haptics on tabs/keys/sends. |
| V9 | Receipt share card | **Full designed artefact** — plate lockup, PAID stamp, mono total, corner brackets, QR/deep-link back to the listing. Every WhatsApp share is an ad. **No fee lines ever (D-014).** |
| V10 | Sound | **Subtle mechanical kit** — three sounds total: message received, payment success, handover confirm. Respects the ring switch; off-switch in settings. Assets must be CC0/free (budget guardrail). |
| V11 | LockedTerms (hirer) | **Vault panel** — corner-bracket ink panel (D-021 motif to mobile), oversized mono total, lock glyph, "Terms locked at acceptance". |
| V12 | Empty states | **Chart-motif set** — compass rose, depth lines, anchor doodles; empties tie back to the map identity. |
| V13 | Listing gallery | **Immersive hero + documentation chips** — full-bleed behind the status bar, parallax on scroll, thumbnail rail, photo index chips. The machine as showpiece with an inspection-report spine. |
| V14 | Guest pull | **Invisible until needed** — zero prompts while browsing; the auth sheet appears only on a protected action and resumes the intent afterwards (07 §7). J2's mid-flow registration is the conversion moment. |
| V15 | Urgency | **Hard** — pulsing CountdownPill + sticky banner + haptic at thresholds for the 24h request and 4h payment windows. The three mandatory deadline placements (07 §10) hold. |
| V16 | Messages | **B2B-hybrid, portal parity** — squared bubbles, date-rule separators, inline system stamps, masked-contact chips. One conversation product on both surfaces. |
| V17 | Verification pitch | **At the cap gate only** — the F2 sheet appears exactly when the Basic cap blocks a request (upload → resume request), plus a quiet status card on Profile. No early nudges. |
| V18 | Releases | **OTA per slice** — one dev-client build up front (founder machine / EAS free tier); each slice ships as an expo-updates push to the founder's device. Mirrors Wave 7's deploy-per-slice rhythm. |

## Scope note (accepted in-session)

V1 (dual theme), V4 (full style JSON), V7 (four moments), and V10 (sound kit) expand slices 8A/8B beyond the wave-8.md floor. The founder accepted this scope during the session. Everything else rides the existing slice plan.

## Non-negotiables restated (from the wave brief, unchanged by this vision)

D-014 absolute on every hirer surface including the receipt artefact · design-system components only, styled from `packages/tokens` · all 7 data states per screen · deadlines in all three mandatory places · money mono/full-value/server-sourced · touch targets ≥48dp · cold start <4s mid-tier Android · copy from the 09 catalogs.
