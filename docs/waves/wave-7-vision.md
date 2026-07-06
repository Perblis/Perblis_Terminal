# Wave 7 — Founder Vision Brief (Supplier Portal)

**Source:** Founder shaping session, 2026-07-03 (48-question elicitation), plus the plan-approval decisions of the same day. This brief is *additive* to [wave-7.md](wave-7.md) — the wave file and the design-system chapters remain normative; where this brief expresses a preference inside their allowed range, this brief wins. **The formal founder go for Wave 7 was given 2026-07-03** with approval of the build plan (which also approved the 5 additive backend endpoints and ratified the D-020 headless allowlist).

## The bar (what "done" feels like)

The portal must read as **premium & trustworthy** and **unmistakably industrial** in the first 10 seconds. North stars: **Linear** (precision, motion restraint), **Stripe Dashboard** (money UI, tables), **Mercury** (editorial confidence). Polish budget is spread evenly: first-run wow AND daily-driver screens.

Founder acid test at the demo (all four, binding):
1. **Screenshot-proud** — any screen, cold, could go in a pitch deck.
2. **Supplier-wow** — a real supplier is visibly surprised a Nigerian B2B tool looks like this.
3. **Holds beside the north stars** — same perceived quality tier, distinct identity.
4. **Details survive zoom** — alignment, spacing rhythm, icon consistency, and all seven data states hold on *every* screen, not just hero paths.

## Visual identity

- **Base theme:** light content region anchored by the ink-900 nav rail. Dark used for drama (rail, vault panel, money moments). **One theme, perfected — no dark mode this wave** (tokens keep it possible later).
- **Color:** restrained precision — ink/paper neutrals; color reserved for status, CTAs, and money. Every colored pixel means something.
- **Motif (one per screen max):** **container-corner brackets** framing key panels (stat cards, LockedTerms, vault).
- **Money is the visual signature:** hero-scale IBM Plex Mono figures on dashboard stats and the P7 "You receive" panel. **Full value always** (₦4,250,000 — never ₦4.25M), tabular alignment in tables.
- **Asset-class identity kit (all three):** custom drawn icon per class + muted class-tinted chips + generated class-illustration fallback covers (no listing ever shows a gray placeholder).
- **Empty states:** crafted duotone SVG scenes (empty yard, idle crane) + clear CTA.
- **Loading:** content-shaped skeletons with shimmer + a small animated Terminal mark for full-page loads.
- **Density:** comfortable default; global toggle to compact (state remembered).
- **Tables (P3/P6):** SaaS-with-console-accents — airy Stripe-grade rows, but mono money/IDs, ruled columns, tight status chips.
- **Typography:** tokens only, used boldly at aggressive sizes/weights. No new fonts.
- **BANNED:** glassmorphism & heavy gradients · emoji in UI · stock-3D illustration style · rounded-everything softness (radii small and consistent).

## Shell & auth (7A)

- **P1 login:** split-screen; right panel = **curated free-stock port/machinery photography** (African/Nigerian scenes where possible), graded into ink duotone, with a barely-perceptible slow pan (respects `prefers-reduced-motion`).
- **Wordmark:** founder has a vision — **rounded square containing an excavator**. Workshop it together when 7A reaches the wordmark; don't finalize solo.
- **Nav rail:** icons + labels, collapsible to icon-only, state remembered.
- **Global chrome:** contextual only — rail badges for counts; dismissible banner solely for genuinely global states (unverified, suspension-risk, payout frozen). No permanent ticker.

## Dashboard (P2)

- **Contextual headline**, not a greeting: "2 requests need a response by 4:00 PM" / "All quiet — next handover Thursday."
- 4-stat row with **quiet 30-day sparklines under the money stats**; hero mono number stays the star.
- **"Action needed" escalates:** quiet amber card normally → under ~4h to nearest expiry: stronger amber, live countdown, rises to a top banner.
- **Activity feed:** grouped by day, rich rows (asset thumbnail/class icon, inline mono money, deep links).

## Onboarding & supply (7B)

- **Stepper:** one step per view, fixed progress rail, quick directional slide transitions, per-step save pulse.
- **Review step:** phone-frame preview (mock hirer-app card) **with a web-view toggle** — both.
- **Photo uploader = the flow's one indulgence:** instant local previews during presigned PUTs, per-photo progress rings, smooth drag-reorder physics, satisfying cover-star moment.
- **Yards:** static map snapshots on cards; live MapLibre only in create/edit modal.
- **Pricing:** **market-position bar** vs similar Live listings nearby (search endpoints); graceful fallback to plain hint on thin data.
- **Completeness:** progress ring + named quality tiers (Basic → Strong → Standout listing) with next unlock stated.

## Hires & money (7C)

- **P7 status:** horizontal **lifecycle rail** (Requested → Accepted → Paid → On hire → Completed; terminal states as a branch) + color-coded status banner.
- **LockedTerms:** hero "You receive" payout — largest figure on the screen — above a bank-statement-ruled breakdown, corner-bracket framed, "locked at acceptance" timestamp.
- **Refund preview:** literal **receipt treatment** — mono, ruled, itemized §7.6 breakdown, both totals, evidence-note field.
- **Countdowns:** tiered ticking — static at long horizons, live mm:ss under ~1 hour.
- **CalendarGantt (all four):** status-colored blocks (pending dashed) · class-tinted row headers with icons · vivid now-rule with live tick · weekend banding + per-row utilisation %.
- **Handover:** **hold-to-confirm** (~1.2s fill); keyboard/reduced-motion fallback = two-step confirm.

## Messages, storefront, settings (7D)

- **Messages:** B2B hybrid — flat aligned rows (no consumer bubbles), day dividers, hire side-strip; MaskedContact anatomy identical to the app per spec.
- **Storefront share:** **designed OG card** (duotone, supplier name, badge, classes, yard count) rendered at the edge — WhatsApp links must look premium.
- **Bank details:** **vault treatment** — distinct ink locked panel, corner brackets, masked mono digits, password re-auth ceremony, encryption note.
- **Verification:** one reusable **progress artifact** (submitted → in review → verified, with dates) identical in Settings, onboarding checklist, and the F9 publish-block.

## Motion & feel

- **Temperament:** precise & restrained — 120–200ms micro-transitions, purposeful easing, no decorative movement.
- **Exactly two signature moments** (sparing, once each): accept → LockedTerms lock/stamp beat · "listing is Live" publish beat at J1's finish line. *(The originally chosen hero-money count-up was dropped by founder decision 2026-07-03 — it conflicted with design-system ch.08's "money never animates; amounts appear set, like print". Ch.08 stands intact.)*
- **Strictly silent.** Tab title + favicon badge carry new-request attention.

## Platform & process

- **Mobile matters:** assume many suppliers on phone browsers — P2/P6/P7/P9 get genuinely designed mobile layouts, not adapted-desktop.
- **Browser floor:** evergreen desktop + recent Android Chrome/WebView.
- **Deploy 7A to Cloudflare Workers immediately** (closes Wave 0's open portal exit criterion early); every slice lands on the live URL.
- **Review cadence:** founder direction-check after 7A (shell + auth + theme + one styled component sheet) **before building outward**. Slice order stays A→E as written.
- **Photography:** curate free-license stock (Unsplash/Pexels), commit graded + optimized assets. $0 — budget guardrail intact.
