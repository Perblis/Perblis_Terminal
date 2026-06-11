# Wave 8 — Hirer App: Map-First Discovery to Paid Hire (Mobile)

**Status:** ⏸ Gated on founder approval (startable any time after the Wave 4 contract freeze; Messages tab additionally needs Wave 5 — TSD §10 interleave note)
**Depends on:** Wave 4 contracts (search contracts from Wave 3; messaging contracts for 8E from Wave 5)
**Spec references:** FSD §10.1 (app surface — normative) · TSD §6 (Expo architecture, payments posture, offline posture, distribution) · `ux/02` (S1–S17 screen specs — **normative per screen**) · `ux/00` J2, J3, J5, J8 (hirer journeys) · `ux/01` F1–F3, F5–F8, F10, F12 · design-system chapters (esp. 06 §3 pins, 08 motion) · DECISIONS D-013 (MapLibre/OpenFreeMap), D-014 (no fee on any hirer surface)
**Numbering note:** the `ux/` docs cite pre-v2.1 FSD numbering — read their "§6.3 / §6.6 / §8.1" as v2.1 **§7.3 / §7.6 / §10.1**.

## Objective

The hirer's pocket front door: install → map → yard pin → listing → request → pay, in **under ten minutes** (J2, FSD §13). The map is the home screen and the product's first impression; the request-to-pay flow is the revenue path (F3); and J8 — the second hire in two taps — is the retention metric every screen decision serves. D-014 is absolute here: no fee or payout figure exists anywhere in this codebase's render tree, receipts and emails included.

## Experience bar (binding, from `ux/03` Stage-6 checklist — applies to both surfaces)

Every screen: design-system components only (NativeWind styled from `packages/tokens`) · **all 7 data states designed** (ideal/empty/loading/partial/error/offline/forbidden) · copy from 09 catalogs · deadlines in all three mandatory places (07 §10) · money mono, full-value, server-sourced · touch targets ≥48dp · cold start to interactive map <4s on mid-tier Android (FSD §12).

## Slices

### 8A — Foundation: scaffold, auth, onboarding (S1–S3 · F1, F12)
- Expo SDK (current) · TypeScript strict · expo-router · TanStack Query + Zustand (session, map filters) · tokens in SecureStore · NativeWind from `packages/tokens` · Sentry.
- S1 splash (plate lockup on ink-900, hazard-stripe footer) + 3-screen onboarding (value prop → how it works → "Suppliers manage on the web"), **skippable after ①, guests proceed to Map browse-only** (FSD §6 guest posture).
- S2/S3 auth + OTP per F1: +234 mask, password strength meter, 6 mono cells, countdown, resend ladder, duplicate-phone → "sign in instead", abandoned-OTP resume on next login.
- F12: silent refresh; expired refresh → re-auth sheet **preserving screen intent**; logout clears SecureStore + Ably detach; suspended → S17 blocking screen with support contact.
- **Guest-intent pattern (07 §7):** any protected action (enquire, request, report) opens the auth sheet and resumes the intent after — J2 registers mid-flow without losing the listing.

### 8B — Map & discovery (S4, S5, S12, S13 · J5, J8 groundwork)
- S4 Map home: `maplibre-react-native` + OpenFreeMap style URL (Protomaps-on-R2 fallback = config swap, D-013); full-bleed "Terminal Chart" style; floating search pill; class FilterBar; locate-me with **contextual pre-prompt** (J2); bottom peek card on pin select.
- **Pin layer per 06 §3 (semantics from FSD §6, normative):** AssetPin (class-coloured teardrop + glyph) · YardPin (logo squircle + count badge + ≤3 class dots + tick — **never dissolves at any zoom**) · Cluster (neutral circle, spatial only, dissolves on zoom; max-zoom tap → contents list; spiderfy for distinct suppliers at one coordinate). Filtered zero-match yards dim to 40%, never vanish.
- `/search/map` on 400ms-debounced pan; result-count chip; >200 results → "zoom in to see all"; **map state (region + filters) persists across sessions** (J8). States: tile shimmer · empty-viewport EmptyState · location-denied → Lagos default + explainer banner + settings link · tile failure → auto list-view banner · offline → cached tiles + ink-900 banner.
- S5 Yard Sheet (half→full snaps): renders **instantly from the map payload** (zero extra round-trips — the TSD §3.7 embedded summaries exist for this), class-grouped rows (★spec caption, mono price, availability caption), storefront footer link, drag-dismiss preserves map position.
- S12 Search & results: expanding pill (text + radius + price + ★spec by class), list/map toggle, **By asset / By location** grouping, clearable filter chips, sort distance|price.
- S13 Storefront: cover (duotone fallback), plate header, stats strip, about, yards row (mini-map cards → map focus), inventory grid with class chips, sticky `Message {name}`. Guest-accessible.

### 8C — Listing → request → pay: the revenue path (S6, S7, S8 · F3 · J2)
- S6 Listing Detail: swipeable 16:10 gallery (counter, M4 corner marks) → title/class/TierBadge → distance pill + yard line → supplier card → S13 → template-driven SpecTable → pricing grid (d/w/m mono-lg) + best-price hint → AvailabilityStrip → **static mini-map with 200m privacy radius until Confirmed** → cancellation summary strip → sticky `Enquire` + `Request to hire`. Dead-link state ("No longer available" + similar row); guest → auth sheet preserving intent.
- S7 Request flow (3-step modal stack): ① dates (held dates struck, live duration line "14 days → 2 × weekly — best price ✓") ② review (**PricePreview manifest: "You pay ₦900,000" hero — no fee or payout lines, D-014**, note field, operator/driver acknowledgment when applicable) ③ confirm → "Awaiting supplier — 24h" → deep-link to S10. Branches per F3: **409 race → "dates just taken" sheet → refreshed strip → re-pick** · Basic-cap gate sheet → F2 verification or reduce dates. Back preserves entries.
- S8 Pay: CountdownPill hero (4h) + LockedTerms (hirer variant) + `Pay now` → `authorization_url` in `expo-web-browser` → on return, **poll hire status — the webhook is the only truth, never the redirect** (TSD §6) → "Confirming with bank…" → success = **stamp moment** (08 motion) + shareable receipt card (**no fee on it**) / failure = mapped reason + "{n} attempts left" + countdown persists / expiry = dates-released copy + re-request CTA. **Never a dead end.**

### 8D — Hires & handover (S9, S10, S11 · F5, F6 · J3, J8)
- S9 My Hires: tabs Requested/Upcoming/On hire/History; HireCards with context strips (countdowns, "Handover today" chips); **"Hire again" row atop History — J8's two-tap re-request**; Ably-live updates + pull-to-refresh.
- S10 Hire Detail: status banner (**all 9 state variants, copy from 09 §3**) → LockedTerms hirer variant → mono dates block → EventTimeline → HandoverRecord cards → conversation row → contextual actions: Cancel (**refund preview manifest with exact FSD §7.6 figures**, F5) · Pay now · Confirm handover · **Raise issue (≤72h post-end → In Dispute)**.
- S11 Handover Capture: camera-first full screen, class-recipe checklist chips (hour meter / odometer / none per FSD §7.4), thumb rail, mono numeric pad for readings, notes, review → submit → ConfirmPanel both-party ticks. **Resume-safe; the one allowed offline mutation** — photos queue locally, record submits on reconnect (TSD §6). Skip path surfaces the dispute-weakening copy beforehand (J3).

### 8E — Messages, profile, reports (S14–S16 · F2, F7, F8, F10 · J5)
- S14/S15 Messages: thread rows with listing/hire context chips, unread badges; conversation with date separators, inline system status messages ("Contact details unlocked"), **MaskedContact chips + first-occurrence explainer** (informative, never punitive), optimistic send with per-message retry; Ably + 15s polling fallback.
- S16 Profile: identity block + "Verify" CTA when Basic; verification status card (F2 approve/reject/resubmit loop, max 3 → support handoff); **"Become a supplier" → F8 explainer + magic-link email to the portal — the app never half-implements supplier tools**; settings (notifications, password, delete with 30-day copy, legal, WhatsApp+email support, version).
- F10 report sheet from S6 overflow: reason select, optional detail, SLA copy, **no further state shown to reporter** (anti-gaming).

### 8F — System posture & distribution (S17 · TSD §6)
- S17: suspended · offline-no-cache · **update-required OTA gate** · 500 (+ Sentry ref) · not-found.
- Offline: tile cache + persisted Query cache (MMKV) — My Hires and Messages render cold; all mutations except handover capture require connectivity.
- Performance gate: cold start <4s mid-tier Android; photo upload <5s/5MB on 4G (client resize via ImageManipulator ≤1920px/~1MB).
- Distribution: local Android builds → founder's device; iOS via EAS free tier; expo-updates OTA for JS-only changes; release checklist documented.

## Out of scope (deferred)

- Push notifications (Phase 3 — badges + email are MVP, FSD §9) · supplier tools in-app (F8 is the boundary) · reviews, saved searches, deposits (Phase 2) · Detox E2E (manual checklist per TSD §8).

## Mandatory tests

- Unit (jest): price-preview hook renders server figures only (never recomputes) · countdown hooks (freeze-time) · masking explainer first-occurrence logic · map-state persistence serializer.
- **D-014 leak test at the render layer:** snapshot every hire-touching screen + the receipt share card as hirer — assert no `service_fee`/`payout` strings or values anywhere.
- State-machine fidelity: S10's banner/action matrix table-driven against all 9 states — no illegal action ever rendered.
- F3 branch coverage as component tests: 409 sheet, cap gate, payment failure copy, expiry copy.
- Manual E2E release checklist (documented, repeatable): J2 + J3 verbatim on a physical device, Paystack test mode.

## Exit criterion (founder demo)

> **Journeys J2 + J3 end-to-end on a physical Android device against production** (Paystack test mode): install → onboarding → map centres on location → filter → YardPin → Yard Sheet → listing → 14-day request showing "2 × weekly — best price" with **total only** → mid-flow registration → supplier accepts (portal) → CountdownPill → pay → poll → Confirmed stamp moment → conversation unmasked → on-hire handover with hour meter → both confirm → On Hire → off-hire → Completed. Stopwatch on J2: **install → request in under 10 minutes**. Then J8: from History, "Hire again" reaches a new request in **two taps**.

## Wave-end checklist

- [ ] `ux/02` coverage check holds: S1–S17 all built; every hire state renders in S9/S10; every flow F1–F12 has its app surface
- [ ] Stage-6 review checklist signed off per screen; cold-start + upload perf numbers recorded
- [ ] Android build on founder's device; iOS EAS build submitted; OTA pipeline verified
- [ ] Founder approval recorded before Wave 9 begins
