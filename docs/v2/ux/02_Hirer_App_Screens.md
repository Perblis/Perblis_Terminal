# 02 · Hirer App — Screen Specifications
Per screen: purpose · anatomy (design-system components by name) · data · states · actions · edge cases. Tab bar: **Map · Search · Hires · Messages · Profile** (05 §5). All copy from 09_Content catalogs.

## S1 · Splash & Onboarding (3 screens)
Plate lockup on ink-900 + hazard stripe footer (M1). Onboarding: ① value prop (duotone port hero + "Find heavy assets near your site") ② how it works (3 steps: discover → request → pay safely) ③ role note ("Suppliers manage on the web"). Skippable after ①. → Auth.

## S2 · Auth (register/sign-in) & S3 · OTP
Standard fields (05 §2), password strength meter, phone with +234 mask. OTP: 6 mono cells, countdown, resend ladder. States: error per F1. Guests can skip from onboarding → Map (browse-only).

## S4 · Map (Home) — the front door
- **Anatomy:** full-bleed Terminal Chart map · floating search pill (top, paper-0, e-1) · class FilterBar chips below it · locate-me control · pin layer (AssetPin/YardPin/Cluster per 06 §3) · bottom peek card on pin select (map-preview ListingCard / YardCard).
- **Data:** `/search/map` viewport+filters; debounced 400ms on pan; result count chip ("34 assets") on filter bar end.
- **States:** loading = tile shimmer + skeleton pins off · empty viewport = EmptyState overlay card ("Nothing here yet — widen search") · location denied = Lagos default + banner explaining + settings link · tiles fail = auto list-view switch banner · offline = cached tiles + ink-900 banner.
- **Actions:** tap pin → peek; tap peek → S5/S6; long-press map = nothing (no hidden gestures); search pill → S12.
- **Edge:** filtered yard with 0 matches dims 40% (never disappears); >200 results = "zoom in to see all" chip; state (region+filters) persists across sessions (J8).

## S5 · Yard Sheet (bottom sheet, half→full)
Header: squircle logo + name + VerifiedBadge + "{n} assets · {distance}". Class filter chips (counts). Rows: grouped by class — title, ★spec caption, price `mono`, availability caption ("6 of 8 free"). Footer: "View company profile →". States: rows render from map payload instantly (TSD §3.8 — no spinner); stale recheck in background. Tap row → S6. Drag down dismiss preserves map position.

## S6 · Listing Detail
- **Anatomy (scroll):** gallery 16:10 swipeable (counter chip, M4 corner marks on first photo) → title h1 + class chip + TierBadge → distance pill + yard line (tap → map focus) → supplier card (avatar squircle, name, VerifiedBadge, listing count → S13) → SpecTable (template-driven) → pricing grid (d/w/m, mono-lg) + best-price hint caption → AvailabilityStrip → availability notes → location mini-map (static, no exact pin jitter — privacy radius 200m until Confirmed) → policy strip (cancellation summary caption) → **sticky bottom action zone:** `Enquire` (secondary) + `Request to hire` (primary).
- **States:** loading skeleton mirrors anatomy · paused/archived listing reached via old link = "No longer available" + similar row · guest taps action → auth sheet preserving intent (07 §7).
- **Overflow:** share, report (F10).

## S7 · Request Flow (3 steps, modal stack)
① Dates: range picker, held dates struck, duration line live ("14 days → 2 × weekly — best price ✓") ② Review: PricePreview manifest ("You pay ₦900,000" hero — no fee or payout lines, D-014), note field, acknowledgment checkbox when operator/driver included ③ Confirm → submitted state ("Awaiting supplier — 24h") → deep-link to S9. Branches per F3 (409 sheet, cap gate). Back preserves entries.

## S8 · Pay
Hire summary header + CountdownPill hero (4h) + LockedTerms + `Pay now` → Paystack browser sheet → return → polling state ("Confirming with bank…") → success = **stamp moment** + receipt card (share CTA) / failure = mapped copy + attempts + retry. Never a dead end: expiry → released copy + re-request.

## S9 · My Hires (tab)
Tabs: **Requested · Upcoming · On hire · History**. HireCards per 06 §2 with context strips (countdowns, action chips "Handover today"). "Hire again" row atop History (J8). Empty states per catalog. Pull-to-refresh; Ably-driven live updates.

## S10 · Hire Detail
Header: listing thumb + title + StatusBadge + hire ID mono. Sections: status banner (state-specific copy/CTA) → LockedTerms (hirer variant) → dates/duration block mono → EventTimeline → HandoverRecords (cards when present) → conversation entry row → contextual actions (Cancel hire w/ refund preview · Pay now · Confirm handover · Raise issue [→ In Dispute, ≤72h post-end]). Every state of the machine has a defined banner (9 variants, copy 09 §3).

## S11 · Handover Capture
Camera-first full-screen, checklist chips overlay (class recipe), thumb rail, reading numeric pad (mono), notes, review → submit → ConfirmPanel (both-party ticks). Resume-safe (photos persist locally). Offline: capture locally, upload on reconnect (the one allowed offline mutation — photos queue, record submits when online).

## S12 · Search & Results
Search pill expands: text field + radius selector + price min/max + ★spec filter (class-dependent) + class chips. Results: list (default) / map toggle; group **By asset / By location** toggle (Fleet spec); ListingCards with distance; sort: distance | price. Filter state chips row (clearable). Empty: "No matches for '{q}'" + clear.

## S13 · Storefront
**Restructured 2026-08-10 (founder direction, two passes) — the facilities are the product and the company is the trust layer around them: facilities → capabilities → trust → supplier → location. This anatomy supersedes the original "stats strip → about → yards row → inventory grid" order, which read as a company profile with inventory attached.**

Cover 150dp (first-listing photo, M4 marks) → compact identity: logo 56, name h1, meta line `{count} {noun} · {n} locations · VerifiedBadge` → location line `{yard} · View on map →` (the page's only tap-through to the map; ≥2 yards render a pill rail instead) → **AVAILABLE TO HIRE** + subline `{count} {noun} · {yard}` → **facility cards** (full-width, vertical: photo 140dp → name → core specification → capability line → day rate with `View {noun} →`; the whole card is the tap target) → `ACROSS ALL {NOUN}` shared-capability line (only when one yard holds every listing, all specs resolved, and ≥3 capabilities are common) → **ABOUT** + member-since → **LOCATION** static mini-map (informational, ~200m privacy radius) → sticky compact `Message {name}` pill. Guest-accessible.

Notes: the noun is class-aware per **D-029** (facilities · assets · listings). Card specifications and capabilities come from `GET /listings/{id}` per facility (capped, cached, shared with S6's cache) because the storefront payload carries no `specs`, `tier` or photo array; a facility whose read is capped or fails renders identically, on a fallback line drawn from the storefront payload. Absence is never rendered as negation — an unfilled capability flag shows nothing, never "No". The storefront has no availability data, so unlike S5/S12 no "Available now" caption appears.

## S14 · Messages (tab) & S15 · Conversation
S14: thread rows (06 §7) sorted by recency, unread badges, search. S15: bubbles, date separators, system status messages inline, MaskedContact chips + first-occurrence explainer, composer; header = counterparty + listing/hire context chip (tap → S6/S10). Optimistic send; failure retry per message.

## S16 · Profile (tab)
Identity block (avatar, name, VerifiedBadge + "Verify" CTA when Basic) → verification status card (F2 states) → Become a supplier row (F8) → settings: notifications (in-app prefs), account (password, delete w/ 30-day copy), legal, support (WhatsApp + email), app version. Sign out.

## S17 · System screens
Suspended (blocking, support contact) · Offline full (no cache) · Update-required (OTA gate) · Error 500 (illustration + Sentry ref) · Not found.

---
**Coverage check:** FSD §8.1 screen list fully mapped (S1–S17); every Hire state renders in S9/S10; every flow F1–F12 has its app surfaces.
