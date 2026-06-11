# Wave 7 — Supplier Portal: The Fleet Cockpit (Web App)

**Status:** ⏸ Gated on founder approval (startable any time after the Wave 4 contract freeze; the Messages slice additionally needs Wave 5's contracts — TSD §10 interleave note)
**Depends on:** Wave 4 contracts (auth/supply contracts from Waves 1–2; messaging contracts for 7D from Wave 5)
**Spec references:** FSD §10.2 (portal surface — normative) · TSD §5 (Next.js/Workers/BFF architecture) · `ux/03` (P1–P12 screen specs — **normative per screen**) · `ux/00` J1, J4, J6 (supplier journeys) · `ux/01` F1–F2, F4–F7, F9, F11–F12 · design-system chapters 01–10 ("Heavy Duty") · DECISIONS D-012 (Workers), D-014 (fee breakdown lives here and only here)
**Numbering note:** the `ux/` docs cite pre-v2.1 FSD numbering — read their "§6.3 / §6.6 / §8.2" as v2.1 **§7.3 / §7.6 / §10.2**.

## Objective

The supplier's entire working life on Terminal happens here: onboard a fleet in under an hour (J1), respond to requests against a live calendar (J6), see the full money picture (LockedTerms supplier variant — the *only* surface besides Ops where the fee breakdown renders, D-014), message hirers, and run a storefront. UX is the deliverable: every screen ships with all seven data states designed, every flow with its named error branches, every deadline surfaced per pattern.

## Experience bar (binding, from `ux/03` Stage-6 checklist)

Every screen in this wave satisfies: components exist in design-system 05/06 (no orphan UI) · **all 7 data states**: ideal / empty / loading / partial / error / offline / forbidden · copy from 09 catalogs only (status vocab table is the only status language) · deadlines surfaced in all three mandatory places (07 §10) · money mono, full-value, **sourced from LockedTerms fields — never recomputed client-side** · one motif max, touch targets ≥40px.

## Slices

### 7A — Foundation: shell, theme, auth (P1, P12, F1, F12)
- Next.js 15 App Router via `@opennextjs/cloudflare`; Tailwind + shadcn/ui **restyled from `packages/tokens`** (no literal hex/px — design.md §5); TanStack Query; react-hook-form + zod mirroring DRF validation.
- **BFF auth (TSD §5):** `/auth/*` route handlers proxy DRF; JWTs in `httpOnly Secure SameSite=Lax` cookies; single-flight auto-refresh on 401; browser JS never sees tokens; all data via `/bff/*`.
- P1 split-screen auth (form left, duotone port photography right — the portal's one cinematic moment), inline OTP per F1 (6-cell mono, countdown, resend ladder, "sign in instead" on duplicate phone, abandoned-OTP resume).
- App frame: ink-900 nav rail (05 §5) + content region (04 §2) + global density toggle. P12 system screens: 404/500 (+ Sentry ref), suspended, **session-expired re-auth modal preserving route** (F12), maintenance flag.

### 7B — Onboarding & supply management (P2 checklist, P3, P4, P5 · F2, F9 · J1)
- **Onboarding checklist** card on dashboard (5 items, progress, per-item CTAs, collapses when complete) — J1's spine. Verification flow F2 reachable contextually from the publish block, never a dead-end.
- P5 Yards: card grid with mini-maps (MapLibre GL), create modal with LocationIQ search + **pin-drop correction as primary** (J1 failure point), delete-only-when-empty with explanation, auto-yard suggestions.
- P4 Asset Form: six-step Stepper with **per-step draft save**; template-driven specs (required fields gate Next, completeness meter); pricing with best-price nudge + PricePreview sample; unit stepper + labels; photo grid uploader (presigned PUT, drag-reorder, cover star, min 1); location = **yard chips first**, "or drop a new pin", save-as-yard toggle; review step = listing as hirers will see it + publish-gates checklist. Publish-blocked states named per F9; edit mode banners "changes don't affect locked terms" when active hires exist.
- P3 Assets DataTable: search, filters (status/class/yard/price), group-by-yard, density; row actions edit/duplicate/pause(undo-toast 6s)/archive; bulk pause/archive/assign-yard; hover status explainers.
- P2 Dashboard: 4-stat row (Earned this month w/ delta · On hire n/total · **Action needed** amber card with nearest-expiry countdown · Unread), payout strip (F11 copy), activity feed (EventTimeline rows, deep links), per-yard tabs when >1 yard. Day-one states: checklist-dominant, **em-dash not ₦0** on zero stats.

### 7C — Hires: respond, monitor, money (P6, P7, P8 · F4, F5, F6, F11 · J4, J6)
- P6 Hires DataTable: tabs **Needs response** (expiry countdown column, amber) / Upcoming / On hire / History; columns incl. hire value + **your payout** (mono); filters; **no bulk actions — decisions are individual (deliberate)**.
- P7 Hire Detail (8+4 layout): main = status banner + listing snapshot + EventTimeline + HandoverRecords; side = **LockedTerms supplier variant ("You receive" hero — full fee breakdown, D-014's one home)** + hirer card (level, completed count) + embedded live conversation panel (lands with 7D; placeholder slot until then).
- Sticky action bar mirrors the state machine **exactly** — the UI can never offer an illegal transition (FSD §7.3). Accept (+ operator/driver acknowledgment checkbox when applicable) · Decline (reason dialog, required) · Cancel (**refund preview manifest** with exact figures per FSD §7.6 + evidence-note field + strike notice copy for supplier cancels, F5) · Confirm handover (ConfirmPanel) · Raise issue.
- P8 CalendarGantt (06 §4): custom CSS grid — **no heavyweight calendar dependency** (TSD §5); yard group headers, unit-utilisation rows, pending blocks dashed, read-only (tooltip "availability is set by hires"), click block → P7.
- Expiry accountability: 3 expiries in 30 days → dashboard warning banner (F4).

### 7D — Messages, storefront, settings (P9, P10, P11 · F7)
- P9 two-pane Messages: thread list (filter all/enquiries/hires) + conversation pane with **identical MaskedContact anatomy to the app** (09 catalog copy); hire-bound threads show side-strip (dates, status, LockedTerms mini); Ably live via `realtime/token`, 15s polling fallback indistinguishable beyond latency; optimistic send with per-message retry; keyboard nav (↑↓ threads, Enter to composer).
- P10 Storefront: live preview-as-hirer + edit drawer (cover, about, logo); share copies public URL; badge state + CAC upgrade CTA.
- P11 Settings: personal · business profile · **bank details masked, edit requires password re-auth, encryption note** · per-event email toggles · verification status/resubmit · account (password; delete with 30-day copy + active-hire guard) · legal.

### 7E — UX hardening pass (the Stage-6 checklist, enforced)
- Sweep every P-screen against the experience bar above; Sentry on the portal; Playwright smoke per TSD §8: **login → create listing → accept hire** against compose; vitest for BFF refresh single-flight and fee-display logic.

## Out of scope (deferred)

- Ops surfaces (Wave 6 owns them) · calendar editing/export (read-only MVP) · bulk hire actions (deliberately none) · supplier mobile experience (portal is responsive-reasonable but desktop-first; the app is hirer-only, F8 explains this in-product).

## Mandatory tests

- vitest: BFF 401 single-flight refresh · cookie security flags · zod↔DRF parity on the asset form · LockedTerms renders only server figures (no client recomputation).
- Playwright smoke (CI, against compose): F1 register→OTP→checklist · F9 full 6-step publish incl. a blocked gate · F4 accept with acknowledgment · refund preview figures match API.
- D-014: fee breakdown appears on P7 side panel and **nowhere on any shared/public render** (storefront preview, share card).
- State-machine fidelity: for each of the 9 hire states, the action bar offers exactly the legal actions (table-driven test).
- All-seven-states snapshot coverage for P2, P3, P6, P7 (the daily-driver screens).

## Exit criterion (founder demo)

> **Journey J1 end-to-end in a real browser on production:** register → OTP → checklist → two yards → 6-step listing → publish blocked (unverified) → verify → publish → duplicate ×N → storefront live with two yard pins on the map. Then **J6's Monday rhythm**: dashboard "Action needed" → accept ×2 / decline ×1 → CalendarGantt shows the fleet → payout strip matches the hire detail manifest. Time J1 (excluding verification wait): the supplier path must be walkable in **under an hour**.

## Wave-end checklist

- [ ] `ux/03` coverage check holds: P1–P12 all built, J1/J4/J6 walkable, every supplier hire action has exactly one home
- [ ] Stage-6 review checklist signed off per screen
- [ ] Playwright smoke in CI; Sentry receiving portal events
- [ ] Founder approval recorded before Wave 8 begins (or confirms 8 was already running in parallel)
