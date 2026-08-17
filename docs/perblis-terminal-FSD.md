---
document_type: FSD
project: Terminal
version: 2.1
status: canonical
supersedes: docs/v2/06_FSD_v2.md
authority: behaviour, actors, states, rules and acceptance
---

# TERMINAL — Functional Specification Document v2.1

**The digital infrastructure for hiring heavy assets in Africa**
v2.1 · June 2026 · Author: Nwabueze Chigozirim Victor (Founder) with Claude
Status: ✅ Canonical reference edition for development

This file is the canonical FSD (D-031). It supersedes `docs/v2/06_FSD_v2.md`, which now
points here. **Section numbers are unchanged** — a citation of the form `FSD §7.6`
resolves against the numbered sections below exactly as before. The requirement layer
(`F-###`) added above them is new; it labels the same behaviour for traceability and
does not restate or amend it. Where the requirement layer and a numbered section could
be read differently, **the numbered section wins** and the difference is a defect to fix.

Authority: this FSD and [DECISIONS.md](../DECISIONS.md) are authoritative for *what the
system does*. [docs/perblis-terminal-TSD.md](perblis-terminal-TSD.md) is authoritative
for *how*. Companion docs: `docs/v2/01_Product_Definition.md` · `02_System_Lexicon.md` ·
`03_MVP_Scope.md` · `04_Architecture_Tech_Stack.md` · `05_Asset_Spec_Schemas.md` ·
`08_Design_System.md` (+ `design-system/` chapters) · `docs/v2/ux/` (journeys, flows,
screens). Delivery sequencing lives only in [docs/waves/README.md](waves/README.md).

## Functional inventory

| ID | Requirement | Source § | Class | Status |
|---|---|---|---|---|
| F-001 | Service fee and duration pricing | §3.1 | money | built |
| F-002 | Payment collection, payouts and refund ledger | §3.2 | money | built |
| F-003 | Money invariants | §3.3 | money | built |
| F-004 | Roles and account levels | §4.1 | identity | built |
| F-005 | Registration and authentication | §4.2 | identity | built |
| F-006 | Identity and business verification | §4.3 | identity | built |
| F-007 | Yards | §5.1 | supply | built |
| F-008 | Listings and publish gates | §5.2 | supply | built |
| F-009 | Listing reports | §5.2 | supply | built |
| F-010 | Storefronts | §5.3 | supply | built |
| F-011 | Map discovery and pin hierarchy | §6 | discovery | built |
| F-012 | Search, filters and result lists | §6 | discovery | built |
| F-013 | Hire request and availability | §7.1 | hire | built |
| F-014 | Supplier date-blocks | §7.1 | hire | built |
| F-015 | Supplier response to a request | §7.2 | hire | built |
| F-016 | Hire state machine | §7.3 | hire | built |
| F-017 | Handover records | §7.4 | hire | built |
| F-018 | Cancellation and refunds | §7.6 | hire | built |
| F-019 | Messaging and contact masking | §8 | messaging | built |
| F-020 | Notifications | §9 | messaging | built |
| F-021 | Hirer mobile app surface | §10.1 | surface | in progress |
| F-022 | Supplier Portal surface | §10.2 | surface | built |
| F-023 | Ops Console surface | §10.3 | surface | built |
| F-024 | Non-functional requirements | §12 | quality | partial |
| F-025 | Launch acceptance gate | §13 | quality | gated |

## Functional requirements

### F-001 — Service fee and duration pricing

- **Kind:** business rule.
- **Purpose:** price a hire from supplier-set rates and derive Terminal's revenue, without fee cliffs and without a minimum hire value.
- **Actors and permission:** computed by the system for any viewer of a listing; the full breakdown renders to the supplier and Ops only (D-014).
- **Inputs/content:** listing asset class, the daily/weekly/monthly rates the supplier has set, and the inclusive day count `d = end_date − start_date + 1`.
- **Actions and outcomes:** best-price selection over only the schemes the supplier set (D-008); the winning scheme sets the fee tier; `service_fee = max(tier_rate × hire_value, ₦2,500)`; `payout_amount = hire_value − service_fee`.
- **States:** figures are previewed at request time, **locked at acceptance**, immutable thereafter.
- **Rules:** §3.1 rules 1–6 and the rate table are normative; ties resolve to the longer scheme; rate-table changes never affect existing hires; the fee never applies to deposits or operator/driver line items.
- **Errors and recovery:** a listing with no daily rate cannot be published (F-008), so pricing always has at least one candidate scheme; corrections after acceptance happen through Refund records and Ops adjustments, never edits.
- **Dependencies:** D-002, D-004, D-005, D-008, D-014; F-008 (rates), F-016 (locking point).
- **Done when:** the five §3.1 worked examples pass as test vectors and property tests hold the floor, monotonicity and `service_fee + payout_amount ≡ hire_value`.

### F-002 — Payment collection, payouts and refund ledger

- **Kind:** journey and business rule.
- **Purpose:** collect the hirer's payment through Terminal and settle the supplier, so the transaction record is complete.
- **Actors and permission:** hirer pays; the system confirms; Ops executes payouts; suppliers see their own payout figures.
- **Inputs/content:** an accepted hire, a gateway checkout, gateway webhooks, and Ops-entered payout references.
- **Actions and outcomes:** acceptance issues a checkout with a **4-hour payment window** and up to 3 attempts; a webhook-confirmed charge moves the hire to Confirmed; completion enqueues a payout at `payout_amount`; refunds issue per §7.6.
- **States:** payment `initiated → success | failed | abandoned`; payout `pending → due → paid`, or `frozen` in dispute; refund `none/pending/completed/failed`.
- **Rules:** confirmation is **never** taken from a client redirect; window expiry or 3 failures auto-cancels (`cancelled_by: system`, reason `payment_expired`) and releases dates; a payout is only created for a completed hire, with the single D-015 exception for the withheld day on a ≤72h hirer cancellation; a daily reconciliation job compares the gateway ledger against payment records and alerts Ops on any mismatch.
- **Errors and recovery:** failed refunds alert Ops; the losing side of a concurrent last-unit payment is refunded in full with an apology notification; missed sweeps self-heal on the next run.
- **Dependencies:** D-006, D-015, D-018 (Paystack collect-only behind a pluggable gateway); F-001, F-016, F-018.
- **Done when:** five end-to-end test-mode hires complete, webhook replay and duplicate delivery are idempotent, and reconciliation reports zero unexplained mismatches.

### F-003 — Money invariants

- **Kind:** business rule.
- **Purpose:** keep every hire's money provably conserved and auditable.
- **Actors and permission:** system-enforced; Ops reads the reconciliation report.
- **Inputs/content:** payments, refunds, payouts and retained fees for one hire.
- **Actions and outcomes:** `collected − refunded − paid_out − retained_fee ≡ 0` holds at every terminal state.
- **States:** evaluated at each terminal hire state (Completed, Cancelled, Declined, Expired).
- **Rules:** financial fields never mutate after acceptance; corrections are Refund records and Ops payout adjustments, all event-logged; all monetary display follows the design-system money rules with D-014 audience separation.
- **Errors and recovery:** a violated invariant is a reconciliation alert to Sentry and Ops email, not a silent correction.
- **Dependencies:** F-001, F-002, F-016; D-014.
- **Done when:** the invariant is asserted as a test at every terminal state and the daily reconciliation runs green.

### F-004 — Roles and account levels

- **Kind:** business rule.
- **Purpose:** gate capability on verification so trust is earned rather than asserted.
- **Actors and permission:** every authenticated user carries `is_supplier` / `is_hirer`; dual accounts hold both.
- **Inputs/content:** role flags and `account_level ∈ {basic, verified, business_verified}`.
- **Actions and outcomes:** Basic may browse, message, enquire and request hires up to ₦250,000 hire value; Verified may publish listings and request without cap; Business Verified additionally earns the storefront shield.
- **States:** Basic → Verified → Business Verified.
- **Rules:** registration defaults hirer ON / supplier OFF; supplier activation requires a completed Business Profile before any listing can go Live; the ₦250k cap is evaluated at request time against `hire_value`.
- **Errors and recovery:** exceeding the cap returns `basic_cap_exceeded` and the request screen surfaces the upgrade prompt; an unverified supplier attempting to publish gets `verification_required`.
- **Dependencies:** F-005, F-006, F-008, F-013; D-001.
- **Done when:** the §4.3 acceptance checks pass — unverified supplier cannot publish, Basic hirer is blocked above ₦250k with an upgrade prompt.

### F-005 — Registration and authentication

- **Kind:** journey.
- **Purpose:** establish one verified identity per person and issue session credentials.
- **Actors and permission:** anonymous visitors register; authenticated users manage their own session.
- **Inputs/content:** full name, unique email, unique Nigerian phone (E.164), password ≥8 chars with 1 uppercase and 1 number.
- **Actions and outcomes:** phone and email are verified **independently** — the phone code only by SMS, the email code only by email, never crossed; login issues a 60-minute access JWT and a 7-day rotating refresh token; password reset is a single-use 1-hour link that invalidates sessions.
- **States:** unverified → phone verified / email verified (independent) → Basic once both hold; sessions active until logout, rotation or `token_version` bump.
- **Rules:** 6-digit OTPs, 10-minute expiry, 3 resends/hour, 5 verify attempts then a new code; login requires **both** channels verified; 5 failed logins per 15 minutes per IP locks out; JWT payload carries `user_id, is_supplier, is_hirer, account_level, is_active`; one account per person; suspension blocks login, hides listings and freezes payouts; deletion is soft for 30 days then hard.
- **Errors and recovery:** phone delivery never fails silently — an unsendable SMS raises `otp_delivery_failed` rather than substituting a channel; `phone_not_verified` / `email_not_verified` gate login; password reset never reveals whether an address exists.
- **Dependencies:** F-004, F-006; NDPR retention carve-outs in §12.
- **Done when:** register → verify both channels → login succeeds against the deployed API, and no code path substitutes one channel for the other.

### F-006 — Identity and business verification

- **Kind:** journey.
- **Purpose:** raise an account's level on human-reviewed documentary evidence.
- **Actors and permission:** the user submits; Ops reviews; documents are readable only through short-lived presigned access.
- **Inputs/content:** identity — one of NIN slip, passport, driver's licence, voter's card (JPEG/PNG/PDF ≤5MB); business — CAC certificate plus RC number.
- **Actions and outcomes:** submission enters the Ops verification queue; approval raises the level; rejection carries a mandatory reason, notifies the user and permits resubmission.
- **States:** `pending → approved | rejected`; one pending request per (user, kind).
- **Rules:** documents go to the private bucket and are never publicly reachable; review SLA is 12 hours; verification is real-but-manual — no environment auto-verifies a user.
- **Errors and recovery:** a rejected user sees the reason and may resubmit; an expired presigned URL is re-minted rather than extended.
- **Dependencies:** F-004, F-005; F-023 (Ops queue).
- **Done when:** the §4.3 acceptance checks pass, including that documents are not reachable without a presigned URL.

### F-007 — Yards

- **Kind:** entity.
- **Purpose:** give a supplier a named location that holds listings and anchors the map's yard pin.
- **Actors and permission:** the owning supplier has CRUD through the portal; yards are publicly visible through storefronts and the map.
- **Inputs/content:** name, geographic pin, address text, city.
- **Actions and outcomes:** listings attach to 0..1 yard and inherit its coordinates; detached listings carry their own pin; moving a listing between yards updates the map immediately.
- **States:** a yard exists or is deleted; a yard holding listings cannot be deleted, only renamed or moved.
- **Rules:** a new listing pinned within 100m of an existing yard prompts "Add to {yard}?"; yard creation is offered during supplier onboarding and inline in the listing form.
- **Errors and recovery:** deleting a yard with listings is refused rather than cascading.
- **Dependencies:** F-008, F-011; D-013 (pin-drop-first location UX).
- **Done when:** a yard with listings refuses deletion and a moved listing relocates on the map without a rebuild.

### F-008 — Listings and publish gates

- **Kind:** entity and journey.
- **Purpose:** publish a supplier's asset as a hireable offer with enough structure to be filtered and compared.
- **Actors and permission:** the owning supplier creates and edits; Live listings are publicly readable; Ops may remove with a reason.
- **Inputs/content:** the six creation steps — class + asset type, title ≤120 chars and description ≥50 chars plus specs per template, pricing with daily required, 1–10 photos, location, review.
- **Actions and outcomes:** publishing makes a listing Live and visible on the map; duplicate clones a listing for fleet entry; `unit_count ≥ 1` models multi-unit listings.
- **States:** Draft → Live ⇄ Paused → Archived; Removed is Ops-only with a required reason and supplier notification.
- **Rules:** publishing is blocked without a daily price, at least one photo, a valid location and every required spec field; tiers are Basic (automatic) / Verified / Inspected with upper tiers awarded manually in MVP; editing a Live listing never alters the locked terms of existing hires; hard delete is never permitted once hire records exist; one ★ filterable headline spec per class.
- **Errors and recovery:** a failed publish names the missing gate; "Other" asset types route to Ops review rather than being rejected.
- **Dependencies:** F-004 (Verified required to publish), F-007, F-001 (rates), `docs/v2/05_Asset_Spec_Schemas.md` (normative templates).
- **Done when:** the §5.2 acceptance checks pass — publish blocked on each missing gate, and a Live edit leaves existing hires' terms intact.

### F-009 — Listing reports

- **Kind:** journey.
- **Purpose:** let hirers flag bad supply without handing them a takedown lever.
- **Actors and permission:** authenticated hirers report; Ops resolves.
- **Inputs/content:** a reason from fraudulent / inaccurate / inappropriate / duplicate / unavailable.
- **Actions and outcomes:** a report enters the Ops reports queue, which shows sibling listings of the same supplier for context.
- **States:** `open → dismissed | warned | removed`.
- **Rules:** reports **never** auto-hide a listing; 3 reports within 30 days set a priority-review flag; report throttle is 5/day/user.
- **Errors and recovery:** dismissal is recorded with a resolution note so a pattern remains visible.
- **Dependencies:** F-008, F-023.
- **Done when:** the third report inside 30 days sets the priority flag and no report path mutates listing status.

### F-010 — Storefronts

- **Kind:** surface.
- **Purpose:** give each supplier a public page that makes the hireable places on it legible and contactable.
- **Actors and permission:** public and read-only; the owning supplier edits the underlying business profile.
- **Inputs/content:** logo, business name, verification badge, member-since, about, yards as mini-map cards, Live listings with class filter chips and per-listing `specs`, `tier` and `available` (D-030).
- **Actions and outcomes:** the Message CTA opens a general enquiry conversation with no listing attached; entry points are the listing-detail supplier card, the Yard Sheet footer and the conversation avatar.
- **States:** visible, or hidden together with the supplier's listings when the supplier is suspended (404, not 403).
- **Rules:** **no hire CTA on the storefront** — hires always flow through a listing so pricing is unambiguous; display copy may call a place a "facility" only where the classes on the page justify it, deriving the noun from the classes actually listed and falling back to "listing" when mixed (D-029); listings are returned in a deterministic `id` order (D-030).
- **Errors and recovery:** a suspended supplier's storefront returns 404 rather than an empty page.
- **Dependencies:** F-007, F-008, F-019; D-029, D-030.
- **Done when:** a suspended supplier's storefront and listings disappear together, and a storefront card carries enough to judge suitability without opening every listing.

### F-011 — Map discovery and pin hierarchy

- **Kind:** surface and business rule.
- **Purpose:** make supply discoverable geographically, with fleets legible as fleets.
- **Actors and permission:** guests may browse the map, listings and storefronts; enquire, request and report redirect to auth.
- **Inputs/content:** viewport or radius, user location, and the active filter set.
- **Actions and outcomes:** the hirer home is a full-screen map centred on the user, falling back to Lagos Island (6.4541, 3.3947) when permission is denied; tapping a yard pin opens the Yard Sheet with listings grouped by class, one distance, and price-from plus availability per row.
- **States:** a pin is an Asset Pin (solo Live listing), a Yard Pin (≥2 Live listings at one yard) or a Cluster (spatial collision at low zoom).
- **Rules:** **a Yard Pin never dissolves at any zoom** — clusters dissolve, yards do not; filtering updates yard badges to matching counts and zero-match yards dim to 40% opacity rather than vanishing; counts are authoritative from the server, never client-estimated.
- **Errors and recovery:** two suppliers at one coordinate render as two pins that spiderfy at max zoom and are never merged.
- **Dependencies:** F-007, F-008, F-012; D-013, D-023 (plate markers).
- **Done when:** the §6 acceptance checks pass — one yard pin at every zoom for one supplier+coordinate, two pins for two suppliers, and map search P95 under 500ms.

### F-012 — Search, filters and result lists

- **Kind:** journey.
- **Purpose:** narrow supply to what a hirer can actually use, and present it two ways.
- **Actors and permission:** public, including guests.
- **Inputs/content:** viewport/bbox or radius (5/10/25/50/100km/custom) around the user or a searched point, class filter, free text over title and description, daily-price min/max, and the per-class ★ spec range.
- **Actions and outcomes:** results render as **By Asset** (flat, with "+N more at this yard" sub-lines) or **By Location** (yard cards interleaved with solo listings); distance is computed server-side and shown as `4.3 km`.
- **States:** paginated by keyset cursor, stable under inserts.
- **Rules:** distance is never client-estimated; filtered counts are authoritative from the server; the `available` flag reflects the chosen date window when one is supplied.
- **Errors and recovery:** a geocode lookup with no key configured returns empty results rather than failing the search.
- **Dependencies:** F-011, F-013 (availability), F-008.
- **Done when:** filtered counts match the server's aggregation and pagination does not duplicate or drop rows under concurrent inserts.

### F-013 — Hire request and availability

- **Kind:** journey and business rule.
- **Purpose:** let a hirer commit to dates against real remaining capacity.
- **Actors and permission:** an authenticated hirer requests; the picker's availability endpoint is public and returns counts only, never counterparty data.
- **Inputs/content:** start and end dates, an optional note to the supplier, and a terms acknowledgment covering ToS and hire terms.
- **Actions and outcomes:** the preview names the winning scheme and shows **the total payable only** (D-014); submission creates a Requested hire.
- **States:** a date range is available iff `overlapping_holds < unit_count`, where holding states are Confirmed, On Hire, and Accepted with an unexpired payment window. **Requested does not hold dates.**
- **Rules:** multiple overlapping Requested hires are allowed — **first-to-pay wins**; when a hire enters Confirmed, overlapping Requested/Accepted hires that now exceed remaining capacity are auto-declined as `no_longer_available` with notifications; requests above ₦250,000 from a Basic hirer are blocked with a verification prompt.
- **Errors and recovery:** held days are struck in the picker before submission, and a 409 `availability_conflict` at submit remains the race safety-net.
- **Dependencies:** F-001, F-004, F-014, F-016.
- **Done when:** a concurrent double-request on the last unit cannot both hold, and the picker's struck days match the server's availability map.

### F-014 — Supplier date-blocks

- **Kind:** entity and business rule.
- **Purpose:** let a supplier reserve a listing's dates for maintenance or off-platform commitments.
- **Actors and permission:** the supplier who owns the listing; a non-owner receives 404, not 403.
- **Inputs/content:** listing, start and end date, reason, creator.
- **Actions and outcomes:** a block is a **hard hold on every unit** for its range — it zeroes public availability and gates confirmation, so request, accept and pay all reject into a blocked range through the existing row-lock re-check.
- **States:** a block exists until hard-deleted; it is supplier configuration, not a transaction record, so removal leaves no audit row.
- **Rules:** blocks never touch existing hires — creating one over a Confirmed hire is allowed and cannot retro-cancel it; MVP blocks the whole listing, per-unit blocking is Phase 2; dates must be ordered, ≤365 days, and not start in the past; overlapping own blocks are allowed.
- **Errors and recovery:** an invalid range returns `block_invalid_range`; a rejected request into a blocked range is indistinguishable from a fully-booked range, by design.
- **Dependencies:** D-024; F-013, F-016.
- **Done when:** a block zeroes availability for its range and introduces no new state-machine edge.

### F-015 — Supplier response to a request

- **Kind:** journey.
- **Purpose:** convert a request into locked commercial terms, or release it cleanly.
- **Actors and permission:** the listing's supplier responds; the hirer is notified either way.
- **Inputs/content:** the request with its full financial breakdown, the hirer's profile (name, account level, completed-hire count), dates and note.
- **Actions and outcomes:** accept locks terms, issues the payment link, soft-holds dates for 4 hours and auto-creates the hire conversation; decline requires a reason from canned options or free text and leaves dates unaffected because they were never held.
- **States:** Requested → Accepted | Declined | Expired.
- **Rules:** no response within **24 hours** expires the request automatically, notifies the hirer and nudges toward similar listings; accepting a listing that includes an operator or driver triggers the responsibility acknowledgment, recorded on the hire.
- **Errors and recovery:** acceptance re-checks availability under a row lock and fails rather than overbooking.
- **Dependencies:** F-001 (locking point), F-013, F-016, F-019 (conversation), F-020.
- **Done when:** a silent supplier's request expires on the timer without manual intervention and the acknowledgment is recorded where required.

### F-016 — Hire state machine

- **Kind:** business rule.
- **Purpose:** make the hire lifecycle a single auditable path, so the transaction record is trustworthy.
- **Actors and permission:** hirer, supplier, Ops and system are the only actor kinds; each transition names its actor.
- **Inputs/content:** the current status, the requested action, and transition metadata.
- **Actions and outcomes:** the §7.3 table is normative — Requested, Accepted, Confirmed, On Hire, Completed, Declined/Expired/Cancelled and In Dispute, with the entry and exit conditions given there.
- **States:** `requested, accepted, confirmed, on_hire, completed, declined, expired, cancelled, in_dispute`; `cancelled_by ∈ {hirer, supplier, ops, system}`.
- **Rules:** **no transition happens outside the state machine and no state is written without its event** — every transition appends to an immutable hire event log carrying timestamp, actor, from→to and metadata; terminal states release dates immediately; all timers run on the task queue, idempotent and crash-safe; capacity-consuming transitions take a row lock and re-check availability inside one transaction.
- **Errors and recovery:** an illegal transition is refused with a stable error code rather than silently ignored; a missed sweep self-heals on the next run.
- **Dependencies:** F-001, F-002, F-013, F-017, F-018; D-015.
- **Done when:** every legal transition and every illegal transition is covered by a test, and the event log renders as the status timeline to both parties.

### F-017 — Handover records

- **Kind:** entity.
- **Purpose:** document what was handed over and returned, so a dispute has evidence.
- **Actors and permission:** either party initiates and the counterparty confirms in-app; only the two parties and Ops can read the photos.
- **Inputs/content:** ≥2 photos, a class-specific reading (hour meter for Plant, odometer for Trucks, none for spaces which use condition and occupancy notes), optional notes, and both parties' confirmation taps.
- **Actions and outcomes:** two records per hire — on-hire and off-hire; the on-hire record promotes the hire to On Hire, the off-hire record completes it.
- **States:** initiated → confirmed by the counterparty; photos additionally carry a purge marker.
- **Rules:** non-blocking in MVP with no deadlines or penalties, but refusal to confirm weakens that party's dispute position; photos go to the **private** bucket and are served as short-lived presigned GETs (D-025); photo objects are **purged 90 days after the off-hire handover is confirmed** while the record rows are retained indefinitely (D-026); an in-dispute hire freezes its evidence from purging.
- **Errors and recovery:** capture works offline — photos queue locally and the record submits on reconnect (D-016), because a lost capture damages the dispute-evidence story.
- **Dependencies:** D-016, D-025, D-026; F-016, F-018.
- **Done when:** photos are unreachable without a presigned URL, the purge sweep is idempotent, and an offline capture survives to submission.

### F-018 — Cancellation and refunds

- **Kind:** business rule.
- **Purpose:** settle a hire that ends early, fairly and identically every time.
- **Actors and permission:** hirer, supplier, Ops or system may cancel; refunds are issued by the system through the gateway.
- **Inputs/content:** who cancelled, when relative to the start date, and whether payment had been taken.
- **Actions and outcomes:** the §7.6 table is normative — pre-payment is free either way; a hirer cancelling >72h before start is refunded 100%; ≤72h the refund is `hire_value − one day's daily-equivalent − ~1.5% processing` and **the withheld day becomes a supplier payout** (D-015); a supplier cancelling post-payment refunds the hirer 100%, Terminal absorbs the processing cost, and the supplier takes a strike.
- **States:** refund `pending → completed | failed`; three supplier strikes trigger a suspension review.
- **Rules:** a hirer no-show at handover +24h is treated as a hirer ≤72h cancellation; a supplier no-show is treated as a supplier cancellation; handover-record absence is the no-show evidence; "one day's daily-equivalent" is `hire_value / duration_days` rounded to the kobo; no cash penalties in MVP.
- **Errors and recovery:** a failed refund alerts Ops rather than retrying silently.
- **Dependencies:** D-015; F-002, F-016, F-017.
- **Done when:** every row of the §7.6 table is a passing test, including the withheld-day payout.

### F-019 — Messaging and contact masking

- **Kind:** journey and business rule.
- **Purpose:** let the two parties talk on-platform, and counter leakage with value rather than blocking.
- **Actors and permission:** the supplier and hirer only; Ops may view in a dispute context; third parties get **404, not 403**.
- **Inputs/content:** message bodies; conversations are Enquiry (listing-level or storefront-level "general") or Hire (auto-created at acceptance).
- **Actions and outcomes:** the message of record persists over REST with realtime fan-out; unread counts accrue per conversation and as an aggregate badge; history is permanent.
- **States:** a hire conversation is masked until its hire has ever reached Confirmed, then unmasked; an enquiry conversation stays masked indefinitely.
- **Rules:** Nigerian phone patterns and email addresses are redacted **server-side at write time**, with the original retained for Ops; masking renders as an informative notice, never punitive; there is no keyword surveillance beyond this pattern, deliberately; bypass-solicitation reports follow the Ops ladder of warn / 7-day suspension / ban; one enquiry conversation per (listing, hirer) and one per hire.
- **Errors and recovery:** a realtime outage degrades to 15-second polling with no message loss, because Postgres is the message of record and fan-out is only fan-out.
- **Dependencies:** D-011; F-010, F-015, F-016.
- **Done when:** the §8 acceptance checks pass — third parties 404, masking lifts only for that hire's conversation, and an outage degrades without loss.

### F-020 — Notifications

- **Kind:** business rule.
- **Purpose:** move each party to the next action without a push dependency in MVP.
- **Actors and permission:** hirer and supplier receive per the §9 matrix; suppliers hold per-type preferences.
- **Inputs/content:** the lifecycle events listed in §9.
- **Actions and outcomes:** MVP channels are the in-app badge and email; push is deferred to Phase 3.
- **States:** a badge accrues until read; an email is sent once per event.
- **Rules:** the §9 matrix is normative, including that the hirer's payment receipt shows **no fee** while the supplier's carries the payout figure (D-014); the accepted-hire email makes the 4-hour deadline prominent; supplier preferences are per-type, default ON, and apply to **email only** — badges always accrue.
- **Errors and recovery:** an email provider failure never blocks the state transition that triggered it, because side-effects dispatch after commit.
- **Dependencies:** D-014; F-016, F-019.
- **Done when:** every §9 row fires from its transition and no hirer-facing message carries a fee or payout figure.

### F-021 — Hirer mobile app surface

- **Kind:** surface.
- **Purpose:** deliver the hirer journey — discover, request, pay, run the hire — on a phone.
- **Actors and permission:** guests may browse; protected actions redirect to auth.
- **Inputs/content:** the screens normative in `docs/v2/ux/02`, listed in §10.1.
- **Actions and outcomes:** map/home, Yard Sheet, listing detail, request flow, pay, My Hires, hire detail, handover capture, messages, storefront, profile and onboarding.
- **States:** tracked per screen in the `ux/02` specs.
- **Rules:** the request preview and every receipt show the total only (D-014); payment status is resolved by polling the hire, never by the browser redirect; pins render as plate markers with restrained motion (D-023).
- **Errors and recovery:** My Hires and Messages render cold from a persisted cache; handover capture is the one allowed offline mutation (D-016).
- **Dependencies:** F-011, F-012, F-013, F-016, F-017, F-019; D-016, D-023.
- **Done when:** Journeys 2 and 3 of §11 complete end-to-end on a device.

### F-022 — Supplier Portal surface

- **Kind:** surface.
- **Purpose:** let a supplier run a fleet — list, price, respond, hand over, get paid — from a browser.
- **Actors and permission:** authenticated suppliers only, through BFF cookie auth.
- **Inputs/content:** the screens normative in `docs/v2/ux/03`, listed in §10.2.
- **Actions and outcomes:** dashboard, assets DataTable with bulk actions and Duplicate, the 6-step listing stepper, yards, hires, the CalendarGantt, hire detail with accept/decline, messages, storefront editing and settings.
- **States:** tracked per screen in the `ux/03` specs.
- **Rules:** the supplier variant of locked terms shows the full breakdown (Hire Value / Service Fee / You Receive); acknowledgment checkboxes appear where operator or driver hires require them; the portal is dark-only and styled from tokens (D-028).
- **Errors and recovery:** the BFF refreshes an expired access token in a single flight and never exposes tokens to browser JS.
- **Dependencies:** F-008, F-014, F-015, F-016, F-017, F-019; D-019, D-020, D-028.
- **Done when:** Journey 1 of §11 — fleet onboarding — completes end-to-end in a browser against production.

### F-023 — Ops Console surface

- **Kind:** surface.
- **Purpose:** give the founder every operational lever without SQL.
- **Actors and permission:** staff only, behind TOTP 2FA.
- **Inputs/content:** the queues and reports listed in §10.3.
- **Actions and outcomes:** dashboard, verification queue, payout queue, listings admin with the reports queue and sibling context, hires admin with the event log and dispute resolution, users administration and the reconciliation report.
- **States:** per queue; dispute resolution exits to Completed or Cancelled with refund and payout adjustments.
- **Rules:** **every Ops action lands in the event log or Django LogEntry**; suspension cascades to listings and payouts; dispute resolution adjustments are recorded, never silent edits.
- **Errors and recovery:** a frozen payout stays frozen until an Ops action releases it.
- **Dependencies:** F-002, F-006, F-009, F-016, F-018.
- **Done when:** the founder operates every queue without touching the database directly.

### F-024 — Non-functional requirements

- **Kind:** constraint.
- **Purpose:** hold performance, security, reliability and compliance to stated numbers.
- **Actors and permission:** system-wide; verified in CI and in the pre-launch runbook.
- **Inputs/content:** the §12 targets for performance, security, money correctness, reliability and NDPR compliance.
- **Actions and outcomes:** each target is measured rather than asserted — map search P95 <500ms at 500 in-radius listings, non-geo API <200ms P95, webhook→state <60s, realtime message <300ms P95, app cold start <4s on mid-tier Android.
- **States:** green or failing per target.
- **Rules:** §12 is normative in full, including bcrypt cost ≥12, Fernet-encrypted bank numbers, 15-minute presigned GETs for private media, webhook HMAC verification with event dedup, staff-only 2FA, and the NDPR retention carve-outs of 7 years financial and 5 years verification documents.
- **Errors and recovery:** a failing target is a launch blocker recorded against F-025, not a silent regression.
- **Dependencies:** every functional requirement; D-026 (handover-photo window).
- **Done when:** every §12 target is measured green and the measurement is repeatable.

### F-025 — Launch acceptance gate

- **Kind:** constraint.
- **Purpose:** define what "ready to launch" means before it is argued about.
- **Actors and permission:** the founder holds the gate.
- **Inputs/content:** the §13 supply, commercial, product and technical criteria.
- **Actions and outcomes:** launch proceeds only when ≥40 Live listings across both corridors and ≥8 storefronts with 3+ listings exist, the product timings hold, the NFRs are green, there are zero unreconciled payment states, and the §11.4 failure scenarios all pass as tests.
- **States:** gated until every criterion is demonstrated.
- **Rules:** §13 is normative; the 60-day commercial targets are measured after launch, not before it.
- **Errors and recovery:** a missed criterion delays the gate rather than being waived silently.
- **Dependencies:** F-001…F-024; D-007 (corridors).
- **Done when:** the founder records the gate as met against demonstrated evidence.

## Blocking open decisions

No blocking O-IDs remain. Every open item tracked in [DECISIONS.md](../DECISIONS.md) is a
product or operational follow-up with a named review point, and none of them changes the
behaviour specified here. The items closest to this document — a structured
certification field for `warehousing`, the design-system chapter reconciliation left open
by D-028, and the asset/facility noun inconsistency on S4/S5/S12 — are scoped as future
work against surfaces that already have specified behaviour, not as gaps in it.

## Verification register

| Requirement | Method | Evidence | Status |
|---|---|---|---|
| F-001 | Test vectors plus property tests | `backend/hires/tests/` fee-engine suite; the five §3.1 worked examples | green |
| F-002 | End-to-end test-mode hires, webhook replay and dedup, daily reconciliation | `backend/payments/`; Wave 4 exit criterion | green |
| F-003 | Invariant asserted at every terminal state | `backend/hires/` and `backend/payments/` suites | green |
| F-004 | Capability matrix tests per level | `backend/accounts/` suite | green |
| F-005 | Register → verify both channels → login against the deployed API | Wave 1 exit criterion | green |
| F-006 | Ops queue review path plus private-media reachability test | `backend/accounts/` verification suite | green |
| F-007 | Delete-guard and 100m inference tests | `backend/suppliers/` suite | green |
| F-008 | Publish-gate tests per missing gate | `backend/listings/state.py` suite | green |
| F-009 | Third-report priority-flag test | `backend/listings/` reports suite | green |
| F-010 | Suspended-supplier 404 test; storefront payload shape | `backend/suppliers/` storefront suite | green |
| F-011 | Solo, yard, filtered and zero-match map cases | Wave 3 exit criterion; `backend/search/` suite | green |
| F-012 | Keyset pagination stability under inserts | `backend/search/` suite | green |
| F-013 | Threaded double-request on the last unit | `backend/hires/` availability race test | green |
| F-014 | Block zeroes availability; no new state edge | `backend/hires/` availability-block suite | green |
| F-015 | 24h expiry timer; acknowledgment recording | `backend/hires/` sweep suite | green |
| F-016 | Every legal and illegal transition | `backend/hires/state.py` suite | green |
| F-017 | Presigned-only reachability; idempotent purge sweep | `backend/hires/` handover suite | green |
| F-018 | One test per §7.6 row | `backend/hires/` refund suite | green |
| F-019 | Third-party 404; masking on/off; polling degradation | `backend/messaging/` suite | green |
| F-020 | Per-row notification dispatch; no fee on hirer surfaces | D-014 serializer-shaping tests | green |
| F-021 | Journeys 2 and 3 on a device | Wave 8 exit criterion | in progress |
| F-022 | Journey 1 in a browser against production | Wave 7 exit criterion | pending sign-off |
| F-023 | Founder operates every queue without SQL | Wave 6 exit criterion | green |
| F-024 | Measured against each §12 target | Wave 9 hardening pass | not started |
| F-025 | Founder records the gate against demonstrated evidence | Wave 9 | gated |

## 1. Document Control

| Field | Detail |
|---|---|
| Title | Terminal — Functional Specification Document |
| Version | 2.1 (expanded reference edition; supersedes v2.0 draft and FSD v1.0 May 2026) |
| Scope | Complete MVP functional behaviour: Hirer mobile app ("Terminal app"), Supplier Portal, Backend API, Ops Console |
| Audience | The founder; coding agents implementing the platform; QA validating behaviour |
| Authority | This FSD + root `DECISIONS.md` are authoritative for *what the system does*. `docs/perblis-terminal-TSD.md` is authoritative for *how*. Where this document conflicts with Policy Bible v1.0 or FSD v1.0, **this document wins.** |
| Vocabulary | Normative per 02_System_Lexicon; quick reference in §2.2 below |

### 1.1 How to read this document (for coding agents)
- **MUST / never / always** statements are requirements. Tables of states, rates, and rules are normative.
- Each module section ends with **Acceptance checks** — testable assertions the implementation must satisfy.
- Decision IDs (D-001…D-031) trace to the root `DECISIONS.md`; do not re-litigate them in code review.
- The `F-###` requirement layer above §1 traces the same behaviour for the TSD's traceability matrix. Section numbers here are stable and are cited across the wave briefs, `docs/v2/ux/` and backend source.

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
