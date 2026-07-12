# TERMINAL — Functional Specification Document v2.1
**The digital infrastructure for hiring heavy assets in Africa**
v2.1 · June 2026 · Author: Nwabueze Chigozirim Victor (Founder) with Claude
Status: ✅ Reference edition for development
Companion docs: 01 Product Definition · 02 System Lexicon · 03 MVP Scope · 04 Architecture · 05 Asset Spec Schemas · 07 TSD · 08 Design System (+ `design-system/` chapters) · `ux/` (journeys, flows, screens) · DECISIONS.md

---

## 1. Document Control

| Field | Detail |
|---|---|
| Title | Terminal — Functional Specification Document |
| Version | 2.1 (expanded reference edition; supersedes v2.0 draft and FSD v1.0 May 2026) |
| Scope | Complete MVP functional behaviour: Hirer mobile app ("Terminal app"), Supplier Portal, Backend API, Ops Console |
| Audience | The founder; coding agents implementing the platform; QA validating behaviour |
| Authority | This FSD + DECISIONS.md are authoritative for *what the system does*. The TSD (doc 07) is authoritative for *how*. Where this document conflicts with Policy Bible v1.0 or FSD v1.0, **this document wins.** |
| Vocabulary | Normative per 02_System_Lexicon; quick reference in §2.2 below |

### 1.1 How to read this document (for coding agents)
- **MUST / never / always** statements are requirements. Tables of states, rates, and rules are normative.
- Each module section ends with **Acceptance checks** — testable assertions the implementation must satisfy.
- Decision IDs (D-001…D-016) trace to DECISIONS.md; do not re-litigate them in code review.

## 2. Product Summary

Terminal is a map-first B2B marketplace where verified **Suppliers** list assets across five classes — Plant & Machinery, Trucks & Haulage, Warehousing & Storage, Terminals & Container Yards, Land & Staging — and **Hirers** discover, compare, and pay for hires through the platform. Terminal owns no assets, arranges no logistics, and is not a party to the hire agreement; its product is the **transaction record**: discoverable supply, verified counterparties, locked commercial terms, paid through Terminal, with a documented handover trail.

**MVP core loop (everything serves this):**
> Supplier lists assets at a Yard → Hirer discovers on the Map → Hire requested → Supplier accepts → Hirer pays via Paystack → On Hire → Off-Hire → Completed, payout queued.

**Four product truths that shape every requirement:** supply is fleets (Supplier → Yard → Listing → Unit is native); trust is the product (verification, locked terms, event logs are first-class); leakage is countered by value, not blocking (payment protection + contact masking until paid); liquidity is corridor-shaped (dual Lagos corridors, D-007).

### 2.1 What Terminal is NOT
Not an asset owner · not a logistics company · not a bank (collect-only payments; licensed PSP rails from Phase 2) · not a sales platform (hire/lease only) · not an employer of operators or drivers (PB §12 liability positions carried forward).

### 2.2 Vocabulary quick reference (normative: doc 02)

| Term | Meaning |
|---|---|
| Supplier / Hirer | The two market sides (`is_supplier` / `is_hirer`; dual = both flags) |
| Hire | The transaction (v1 "booking"). Lifecycle states in §7.3 |
| Listing | The published offer of an asset; **Asset** = the physical thing; **Unit** = one machine within a multi-unit listing |
| Yard | A supplier's named location holding listings. **Site** is reserved for the hirer's project location |
| Live | Published listing status (never "active" — that word belongs to nothing; the hire in-use state is **On Hire**) |
| Service Fee | Terminal's revenue (user-facing term; "commission" internal only). Supplier-pays (D-005), supplier-confidential from hirers (D-014) |
| Hire Value / Supplier Payout | What hirer pays / what supplier receives |
| Storefront | A supplier's public company page |
| Ops Console | The founder's Django-Admin operations surface |
| Conversation / Enquiry | Messaging objects (enquiry = pre-hire, listing- or storefront-level) |
| Handover Record | Documented on-hire / off-hire evidence object |
| Verification | User-facing word for KYC; levels Basic → Verified → Business Verified |

## 3. Business Rules — Money

### 3.1 Service Fee (D-002, D-008, D-014)

Rates by asset class and winning duration scheme:

| Asset class | Daily | Weekly | Monthly |
|---|---|---|---|
| Plant & Machinery | 12% | 10% | 8% |
| Trucks & Haulage | 11% | 9% | 7% |
| Warehousing & Storage | 10% | 8% | 6% |
| Terminals & Container Yards | 10% | 8% | 6% |
| Land & Staging | 10% | 8% | 6% |

Rules:
1. **Best-price rule (D-008):** `hire_value = min(daily×d, weekly×ceil(d/7), monthly×ceil(d/30))` computed over only the rate schemes the supplier has set. The scheme producing the minimum sets the fee tier. Ties resolve to the longer scheme (lower rate). `d = end_date − start_date + 1` (inclusive).
2. **Fee floor:** `service_fee = max(tier_rate × hire_value, ₦2,500)`. No flat-fee override; no minimum hire value (D-004).
3. **Supplier pays the fee (D-005):** hirer pays `hire_value` exactly; `payout_amount = hire_value − service_fee`.
4. **Supplier-confidential (D-014):** hirers see only the total they pay. No service-fee or payout figure may render on any hirer surface (request preview, hire detail, receipts, emails). The full breakdown (Hire Value / Service Fee / You Receive) renders on supplier and Ops surfaces only. ToS discloses the fee model in legal terms.
5. **Locking:** `hire_value`, `service_fee`, `payout_amount`, `fee_basis` (e.g. `"10% weekly (min ₦2,500)"`) are computed at request time for preview, **locked at acceptance, immutable thereafter**. Rate-table changes never affect existing hires.
6. Fee applies to hire value only — never to deposits (deferred) and never line-items operator/driver rates (suppliers price them into their rates in MVP).

**Worked examples** (agents: these are test vectors):

| Scenario | Rates set | d | Winning scheme | hire_value | service_fee | payout |
|---|---|---|---|---|---|---|
| Excavator, daily ₦80k only | d | 3 | daily ×3 | ₦240,000 | 12% = ₦28,800 | ₦211,200 |
| Excavator, ₦80k/d + ₦450k/w | 14 | — | weekly ×2 = ₦900k < daily ×14 = ₦1.12M | ₦900,000 | 10% = ₦90,000 | ₦810,000 |
| Same listing, 8 days | — | 8 | min(8×80k=640k, 2×450k=900k) = **daily ×8** | ₦640,000 | 12% = ₦76,800 | ₦563,200 |
| Generator ₦15k/day | d | 1 | daily | ₦15,000 | max(12%×15k=1,800, 2,500) = **₦2,500** | ₦12,500 |
| Warehouse ₦350k/month | m | 30 | monthly | ₦350,000 | 6% = ₦21,000 | ₦329,000 |

### 3.2 Payments (D-006 — collect-only)
- On supplier acceptance the hirer receives a Paystack checkout (card / bank transfer / USSD). **Payment window: 4 hours** from acceptance; up to 3 charge attempts within the window.
- Successful charge (webhook-confirmed, never client-redirect-confirmed) → hire becomes **Confirmed**. Window expiry or 3 failed attempts → auto-cancel (`cancelled_by: system`, reason `payment_expired`), dates released, both parties notified.
- A daily reconciliation job compares the Paystack ledger against payment records; any mismatch alerts Ops. Zero-mismatch is a launch criterion.
- **Payouts:** when a hire completes, a payout record (state `due`) enters the Ops payout queue at `payout_amount`. Founder executes bank transfers weekly, recording a reference per payout. States: `pending → due → paid`, or `frozen` (dispute). A payout is never created for a hire that did not complete — with one exception (D-015): the withheld day on a ≤72h hirer cancellation becomes a supplier payout (`due`) per §7.6.
- **Refunds** per §7.6, issued via Paystack refund API, tracked per hire (`none/pending/completed/failed`); failures alert Ops.

### 3.3 Money invariants (system-wide)
- Per hire: `collected − refunded − paid_out − retained_fee ≡ 0` at all terminal states.
- Financial fields never mutate after acceptance; corrections happen via Refund records and Ops payout adjustments, all event-logged.
- All monetary display follows design-system money rules (Plex Mono, full value on transactional screens; D-014 audience separation).

## 4. Users, Roles & Verification

### 4.1 Roles & account levels
- Role flags: `is_supplier`, `is_hirer`. Registration defaults hirer ON / supplier OFF. Activating supplier requires completing the Business Profile (business name, description, bank details) before any listing can go Live. Dual accounts switch modes in UI; one identity, one wallet of records.
- **Account levels** (user-facing "Verification"):

| Capability | Basic (OTP+email) | Verified (ID approved) | Business Verified (CAC approved) |
|---|---|---|---|
| Browse, message, enquire | ✔ | ✔ | ✔ |
| Request hires | ✔ ≤ ₦250,000 hire value | ✔ unlimited | ✔ unlimited |
| Publish listings | ✖ | ✔ | ✔ |
| Storefront "Business Verified" shield | ✖ | ✖ | ✔ |

The ₦250k Basic cap is evaluated at request time against `hire_value`; the request screen surfaces the verification prompt when exceeded.

### 4.2 Registration & authentication
- Register: full name, email (unique), Nigerian phone (unique, E.164 normalised), password ≥8 chars incl. 1 uppercase + 1 number. **Both channels verified independently** (6-digit OTP each, 10-min expiry, 3 resends/hour, 5 verify attempts then new code): the **phone** code is sent **only by SMS via Termii**, the **email** code **only by email via Resend** — codes are never crossed. Phone delivery never fails silently: if SMS can't be sent it surfaces an error rather than substituting another channel (dev without keys prints to console). Welcome email via Resend.
- Login: email+password → JWT access (60 min) + refresh (7 days, rotating, blacklist on logout). Requires **both** phone and email verified (Basic = OTP + email, §4.1). 5 failed logins / 15-min IP lockout. Password reset: single-use emailed link, 1-hour expiry, invalidates sessions.
- JWT payload: `user_id, is_supplier, is_hirer, account_level, is_active`.
- One account per person (PB §2.4). Suspension blocks login, hides listings, freezes payouts. Deletion is soft (30-day recovery) then hard, except: financial records retained 7 years, verification documents 5 years (NDPR).

### 4.3 Verification (real-but-manual, 03 §5)
- Identity: one document (NIN slip / passport / driver's licence / voter's card), JPEG/PNG/PDF ≤5MB → private R2 bucket; pre-signed access only; enters Ops verification queue; approve → Verified, or reject with mandatory reason (user notified, may resubmit). SLA 12h.
- Business: CAC certificate + RC number, same queue → Business Verified.
- **Acceptance checks:** unverified supplier cannot publish; Basic hirer blocked >₦250k with upgrade prompt; rejected user sees the reason and can resubmit; docs never publicly reachable.

## 5. Supply — Yards, Listings, Storefronts

### 5.1 Yards
- Fields: name, pin (geographic point), address text, city. Supplier CRUD in portal; a yard with listings cannot be deleted (rename/move only). Listings attach to 0..1 yard and inherit its coordinates; detached listings carry their own pin. Moving a listing between yards updates the map immediately.
- Auto-yard inference: a new listing pinned within 100m of the supplier's existing yard prompts "Add to {yard}?". Yard creation is offered during supplier onboarding and inline in the listing form.

### 5.2 Listings
- **Creation (6 steps):** ① class + asset type (from doc 05 launch set; "Other" routes to Ops review) → ② title ≤120 chars, description ≥50 chars, specs per template (required spec fields gate publishing) → ③ pricing: daily ₦ required; weekly/monthly optional; `unit_count` ≥1 (labels per unit optional) → ④ photos 1–10 (JPEG/PNG/WebP ≤10MB each; drag-reorder; cover select) → ⑤ location: yard chip OR pin-drop OR address geocode (pin-drop-first UX, D-013) → ⑥ review & publish.
- **Statuses:** Draft → Live ⇄ Paused → Archived; Removed (Ops only, reason required, supplier notified). Archived/Removed listings preserve hire history; hard delete never permitted once hire records exist. Editing a Live listing never alters locked terms of existing hires.
- **Tiers:** Basic (automatic at publish) / Verified / Inspected — upper tiers manually awarded via Ops in MVP (PB §3.4–3.5 video/inspection machinery activates Phase 3).
- **Spec templates (doc 05 is normative):** per class+type; field kinds number/text/select/multi/boolean with units; required fields gate Draft→Live; one ★ filterable headline spec per class (operating_weight · payload_capacity · floor_area · container_capacity TEU · area). Completeness score stored (ranking input later, not MVP-visible).
- **Reports:** authenticated hirers report a listing (fraudulent / inaccurate / inappropriate / duplicate / unavailable). Reports never auto-hide a listing; 3 reports in 30 days flag priority review; Ops queue shows sibling listings of the same supplier.
- **Acceptance checks:** publish blocked without daily price, ≥1 photo, valid location, required specs; Live→edit keeps existing hires' terms intact; report #3 inside 30 days sets the priority flag.

### 5.3 Storefronts
- Public, read-only company page per supplier: logo, business name, verification badge, member-since, about, yards as mini-map cards, live listings with class filter chips, **Message CTA** → general enquiry conversation (no listing attached).
- Entry points: listing detail supplier card, Yard Sheet footer, conversation avatar. **No hire CTA on the storefront** — hires always flow through a listing (pricing must be unambiguous).
- Suspended supplier → storefront and listings hidden together.

## 6. Discovery — Map & Search

- Hirer app home = full-screen map (**MapLibre GL + OpenFreeMap tiles, D-013**), centred on user location; permission denied → Lagos Island (6.4541, 3.3947). **Guest browsing permitted** (map, listings, storefronts); protected actions (enquire, request, report) redirect to auth.
- **Pin hierarchy (normative, Fleet UX Spec):**
  - *Asset Pin* — a solo (yardless or single-listing-yard) Live listing; class-coloured teardrop with class glyph.
  - *Yard Pin* — ≥2 Live listings sharing a yard; supplier logo squircle + count badge + ≤3 class dots + verification tick. **Semantic: never dissolves at any zoom.** Tap → **Yard Sheet**: listings grouped by class, one distance shown, price-from + availability per row, storefront link.
  - *Cluster* — spatial collision of distinct pins at low zoom; neutral circle + count; tap = zoom (max zoom → list of contents). Clusters dissolve on zoom; yards don't.
- Filtering updates yard badges to **matching counts**; zero-match yards dim to 40% opacity (never vanish).
- **Search params:** viewport/bbox + radius (5/10/25/50/100km/custom) around user or searched point; class filter; text (title+description); daily-price min/max; the ★ spec filter per class. Distance is computed server-side (PostGIS geography) and shown as `4.3 km`; never client-estimated.
- Results list view toggles **By Asset** (flat, with "+N more at this yard" sub-lines) / **By Location** (yard cards interleaved with solo listings).
- **Acceptance checks:** same supplier+coordinates ⇒ one yard pin at every zoom; two suppliers at one coordinate ⇒ two pins (spiderfy at max zoom), never merged; filtered counts authoritative from server; map search P95 <500ms.

## 7. The Hire Lifecycle

### 7.1 Request
- Hirer selects start/end dates on listing detail; dates with no availability are blocked in the picker. Preview shows winning scheme ("14 days → 2 × weekly — best price") and **the total payable only** (D-014). Optional note to supplier. Terms acknowledgment checkbox (ToS + hire terms).
- **Availability (unit-aware):** a date range is available iff for the listing, `overlapping_holds < unit_count`, where holding states = **Confirmed, On Hire, and Accepted with unexpired payment window**. `Requested` does NOT hold dates. The picker reads a public per-day availability endpoint (`GET /listings/{id}/availability`, counts only — no counterparty data) so held days are struck before the hirer requests; the 409 `availability_conflict` at submit remains the race safety-net.
- **Supplier manual date-blocks (D-024):** a supplier can block date ranges on a listing (maintenance, off-platform commitments) from the CalendarGantt. A block is a **hard hold on the whole listing** — it strikes those days in the hirer picker and rejects request/accept/pay exactly as a fully-booked range would. Blocks never touch existing hires.
- Multiple overlapping `Requested` hires are allowed — **first-to-pay wins**. When a hire enters Confirmed, overlapping Requested/Accepted hires that now exceed remaining capacity are auto-declined (`no_longer_available`), with notifications.
- Basic-level cap: requests with `hire_value > ₦250,000` are blocked with a verification prompt (§4.1).

### 7.2 Supplier response
- Supplier sees the request with full financial breakdown, hirer profile (name, account level, completed-hire count), dates, note.
- Accept → terms lock, payment link issued, dates soft-held 4h, hire conversation auto-created. Accepting a listing with operator/driver-included triggers the responsibility acknowledgment (PB §12.2), recorded on the hire.
- Decline → mandatory reason (canned options + free text); dates unaffected (they were never held).
- No response in **24h** → automated **Expired**; hirer notified and nudged toward similar listings.

### 7.3 Hire state machine (normative)

| # | State | Entry | Exits |
|---|---|---|---|
| 1 | **Requested** | Hirer submits | → Accepted (supplier) · → Declined (supplier, reason) · → Expired (24h timer) · → Cancelled (hirer withdraws) |
| 2 | **Accepted** | Supplier accepts; terms locked; payment link issued; dates soft-held | → Confirmed (payment webhook) · → Cancelled `system/payment_expired` (4h timer / 3 failed attempts) · → Cancelled (either party, pre-payment, free) |
| 3 | **Confirmed** | Payment received | → On Hire (start date + on-hire Handover Record, or auto at start+24h) · → Cancelled (refund rules §7.6) |
| 4 | **On Hire** | Start reached / handover confirmed | → Completed (end passed + off-hire record, or auto at end+48h undisputed) · → In Dispute |
| 5 | **Completed** | Off-hire confirmed | Payout becomes `due`. Terminal state. |
| 6 | **Declined / Expired / Cancelled** | Per above; `cancelled_by ∈ {hirer, supplier, ops, system}` + reason | Terminal states; dates released immediately |
| 7 | **In Dispute** | Either party flags during On Hire or ≤72h after end | Payout frozen; founder mediates; Ops resolves → Completed or Cancelled (+refund/payout adjustment, event-logged) |

- All timers (24h, 4h, auto-promotions) run on the task queue, idempotent and crash-safe.
- **Every transition appends to an immutable hire event log** (timestamp, actor, from→to, metadata) — rendered as the status timeline to both parties and as evidence in disputes. No transition happens outside the state machine; no state is written without its event.

### 7.4 Handover Records (lite)
- Two per hire: **on-hire** and **off-hire**. Either party initiates, the counterparty confirms in-app. Contents: ≥2 photos, class-specific reading (hour meter — Plant; odometer — Trucks; none — spaces, which use condition/occupancy notes; per 03 §7), optional notes, both parties' confirmation taps.
- Non-blocking in MVP (no deadlines or penalties), but refusal to confirm weakens that party's dispute position (PB §10.4 defaults applied as Ops guidance).
- Photos go to the private bucket; visible only to the two parties and Ops (D-025 — binding; served as short-lived presigned GETs on both surfaces). Photo objects are **purged 90 days after the off-hire handover is confirmed** (D-026); the record itself — kind, reading, timestamps, confirmations — is retained indefinitely as dispute/transaction evidence.

### 7.5 Extensions
Not in MVP — cancel-and-rebook. `parent_hire` reserved for Phase 2.

### 7.6 Cancellation & refunds (normative)

| Scenario | Outcome |
|---|---|
| Pre-payment (Requested/Accepted), either party | Free; no money moved |
| Hirer cancels post-payment, >72h before start | 100% refund |
| Hirer cancels post-payment, ≤72h before start | Refund = hire_value − one day's daily-equivalent − ~1.5% processing. The withheld day becomes a supplier payout (`due`) |
| Supplier cancels post-payment (any time) | Hirer refunded 100% (Terminal absorbs processing cost); supplier strike (3 strikes → suspension review). No cash penalties in MVP |
| Hirer no-show (handover +24h) | Treated as hirer ≤72h cancellation |
| Supplier no-show (asset unavailable at handover) | Treated as supplier cancellation |

Handover Record absence is the no-show evidence. "One day's daily-equivalent" = `hire_value / duration_days`, rounded to the kobo.

## 8. Messaging
- **Conversations:** Enquiry (listing-level, or storefront-level "general") and Hire conversations (auto-created at Accepted). Parties: the supplier and hirer only; Ops may view in dispute context. One enquiry conversation per (listing, hirer); one conversation per hire.
- Delivery: message of record persists via REST; **realtime fan-out via Ably (D-011)**; graceful degradation to 15-second polling. History permanent. Unread counts per conversation + aggregate badge.
- **Contact masking until the related hire is Confirmed:** in enquiry and pre-payment hire conversations, Nigerian phone patterns and email addresses are redacted server-side at write time (rendered as `0803••• 🔒` + "Unlocks after payment" explainer — informative styling, never punitive). Post-payment hire conversations are unmasked. No keyword surveillance beyond this regex (deliberate privacy posture). Bypass-solicitation reports → Ops ladder: warn / 7-day suspension / ban (PB §11.5).
- Conversation list rows: counterparty + verification badge, listing thumbnail + title (or "General enquiry"), yard name, last message preview, timestamp, unread badge.
- **Acceptance checks:** third parties get 404 on others' conversations; masking applies pre-payment and lifts post-payment for that hire's conversation only; enquiry conversations stay masked indefinitely; Ably outage degrades to polling without message loss.

## 9. Notifications (MVP = in-app badge + email; push deferred Phase 3)

| Event | Hirer | Supplier | Channel |
|---|---|---|---|
| Hire requested | — | ✔ | badge + email |
| Accepted (pay now, 4h) | ✔ | — | badge + email (deadline prominent) |
| Declined / Expired | ✔ | — / reminder at 20h | badge + email |
| Payment confirmed | ✔ receipt (no fee shown) | ✔ (with payout figure) | badge + email |
| Payment window expiring (60 min left) | ✔ | — | badge + email |
| Auto-cancelled (payment expired) | ✔ | ✔ | badge + email |
| Cancellation (any) | ✔ | ✔ | badge + email |
| Handover awaiting confirmation | counterparty | counterparty | badge |
| Hire completed | ✔ | ✔ (+payout queued) | badge + email |
| Payout paid | — | ✔ (reference) | email |
| New message | ✔ | ✔ | badge (realtime) |
| Verification approved/rejected | ✔ | ✔ | badge + email |
| Supplier strike / listing removed | — | ✔ (reason) | email |

Supplier notification preferences (per-type toggles, default ON) apply to email only; badges always accrue.

## 10. Surfaces

### 10.1 Hirer Mobile App ("Terminal app") — screens normative in `ux/02`
Map/Home (pin hierarchy, filter bar, search) · Yard Sheet · Listing Detail (gallery, dynamic SpecTable, pricing grid + best-price hint, supplier card → Storefront, availability calendar, Enquire / Request to Hire, report via overflow) · Request flow (dates → preview [total only, D-014] → note → acknowledge → confirm) · Pay (Paystack in in-app browser + CountdownPill; status resolved by webhook polling, never the redirect) · My Hires (tabs Requested / Upcoming / On Hire / History) · Hire Detail (EventTimeline, LockedTerms hirer variant, handover records, conversation link, cancel) · Handover capture (camera-first, reading field, confirm) · Messages + Conversation (MaskedContact notices) · Storefront · Profile (verification status/upload, role activation, settings) · Onboarding (role intent, OTP, optional verification prompt). Design language per doc 08 ("Heavy Duty").

### 10.2 Supplier Portal — screens normative in `ux/03`
`/dashboard` (pending requests with 24h countdowns, awaiting-payment, unread, month earnings, next payout, activity feed) · `/assets` (DataTable: status/class/yard filters, bulk pause/archive/assign-yard, **Duplicate Listing**) · `/assets/new` & `/assets/:id` (6-step Stepper; spec template renders per class) · `/yards` (CRUD) · `/hires` (DataTable + filters) · `/hires/calendar` (CalendarGantt: yard-grouped rows, unit-utilisation bars, pending dashed) · `/hires/:id` (LockedTerms supplier variant, accept/decline+reason, handover records, chat panel) · `/messages` · `/storefront` (public preview + business profile edit) · `/settings` (personal, business, bank masked, notification prefs, password, verification). Acknowledgment checkboxes where required (operator/driver hires).

### 10.3 Ops Console (Django Admin, staff-only + 2FA)
Dashboard (GMV, fees collected, payout liability, hires by state, new users, reconciliation status) · Verification queue (doc viewer, approve/reject+reason) · Payout queue (due payouts, bank details, mark-paid+reference, freeze/unfreeze) · Listings admin (tier award, pause/remove+reason, reports queue with sibling context) · Hires admin (event log, admin cancel, dispute resolution: → Completed or → Cancelled + refund/payout adjustments) · Users (suspend/reactivate, strikes, notes) · Reconciliation report. **Every Ops action lands in the event log / Django LogEntry.**

## 11. End-to-End Journeys (acceptance narratives; expanded in `ux/00`)

1. **Fleet supplier onboards** — Adaeze (BNN, 25 assets, 2 yards): register → OTP → supplier activation + business profile → ID verified by Ops ≤12h → creates Apapa + PH yards → first listing via 6-step form (yard chip, specs template) → duplicates for the fleet, unit_count for the 8 identical tippers → map shows two BNN yard pins, badges 20 and 5. *Under an hour of work.*
2. **Hirer discovers and pays** — Emeka (site manager): installs app → map → filters Plant → yard pin 12.4km → Yard Sheet → CAT 320 listing → 14 days → "2 × weekly" preview ₦900,000 total → registers + OTP mid-flow → requests → Tunde accepts in 3h → Emeka pays via transfer within window → Confirmed; conversation unmasks; receipt (no fee shown).
3. **The hire runs** — on-hire handover (photos + hour meter, both confirm) → On Hire → off-hire record at return → Completed → payout `due` ₦810,000 → founder pays Friday batch, records reference → supplier emailed.
4. **Things go wrong (each a test scenario):** supplier silent 24h → Expired + hirer nudge · payment window lapses → auto-cancel + dates release · hirer cancels 5 days out → 100% refund · supplier cancels paid hire → full refund + strike · damage claim → In Dispute → payout frozen → Ops resolves with adjustment · fake listing reported 3× → priority review → Removed + supplier note.
5. **Ops weekly rhythm** — verification queue twice daily (12h SLA), payout batch Fridays, reports queue, reconciliation green daily, weekly metrics digest email.

## 12. Non-Functional Requirements
- **Performance:** map search <500ms P95 @ 500 in-radius listings; non-geo API <200ms P95; webhook→state <60s; realtime message <300ms P95; photo upload <5s/5MB on 4G; app cold start to interactive map <4s mid-tier Android.
- **Security:** HTTPS+HSTS; JWT 1h/7d rotating+blacklist; bcrypt cost ≥12; bank numbers encrypted at rest (AES-256/Fernet); private R2 + short-lived presigned GETs for docs/handover photos; Paystack HMAC-SHA512 webhook verification + event dedup; auth rate limits (§4.2); CORS allowlist; Ops Console staff-only + 2FA; no secrets in clients.
- **Money correctness:** §3.3 invariants; daily reconciliation; immutable financials; append-only event log.
- **Reliability:** 99.5% uptime; Sentry on all four surfaces; daily DB backups, 7-day retention; Ably→polling degradation; timers queue-backed and idempotent (a missed sweep run self-heals next run).
- **Compliance (NDPR):** ToS/Privacy at registration; per-hire acknowledgments; retention — financial 7y, verification docs 5y; soft delete 30d → hard delete with carve-outs; data stored in NDPR-compatible jurisdictions.

## 13. Launch Acceptance (gate, from 03 §8)
- **Supply:** ≥40 Live listings (≥25 construction corridor, ≥15 port corridor), ≥8 storefronts with 3+ listings.
- **Within 60 days:** ≥25 paid hires; ≥₦500k service fees collected; ≥30% hirer repeat rate.
- **Product:** supplier register→Live <1 day; hirer install→request <10 min; full loop incl. handover unaided.
- **Technical:** NFRs green; zero unreconciled payment states; the §11.4 failure scenarios all pass as tests.

— End of FSD v2.1 —
