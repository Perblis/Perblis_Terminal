# Wave 4 — Hires & Money: State Machine, Fees, Paystack, Payouts

**Status:** ⏸ Gated on Wave 3 sign-off
**Depends on:** Waves 1–3 (auth + account levels, Live listings, search)
**Spec references:** FSD §3 (money rules — worked examples are test vectors) · §7 (hire lifecycle — state table normative) · §9 (notification matrix) · TSD §3.2 (fee engine code), §3.3 (`hires`, `hire_events`, `handover_records`, `payments`, `paystack_events`, `refunds`, `payouts`), §3.4 (availability + race rule — **binding**), §3.5 (state machine & timers), §3.6 (Paystack) · DECISIONS D-002, D-004, D-005, D-006, D-008, D-014, D-015

**This is the heaviest wave and the heart of the product. Coverage gate here is 85%. Build it as the six slices below, in order — each slice lands with its tests before the next begins.**

## Objective

The full money loop, real: request → accept (terms lock) → Paystack checkout → webhook-confirmed payment → On Hire → handovers → Completed → payout queued — with every transition event-logged, every financial rule per FSD §3, every race handled per the binding concurrency contract, and D-014 enforced at the serializer layer.

## Slices

### 4A — Fee engine (`hires/fees.py`, pure)
- Implement TSD §3.2 exactly: integer per-mille `RATE_TABLE`, `FEE_FLOOR = 250_000` kobo, best-price rule over only set schemes, tie → longer scheme, `service_fee = max(value×rate//1000, floor)`, `fee_basis` string.
- Tests: the **five FSD §3.1 worked examples verbatim** + hypothesis properties (monotonicity in days; floor honoured; `payout + fee ≡ value`; scheme optimality — no other set scheme yields a lower value).

### 4B — Hire model, state machine, availability
- Models per TSD §3.3: `hires` (financials **locked at acceptance** — DB trigger or service-level guard + test), `hire_events` **append-only** (revoke UPDATE/DELETE from app role), `handover_records`.
- `hires/state.py`: `TRANSITIONS` table per FSD §7.3 (7 states; all legal exits; `cancelled_by` + reason taxonomy). `apply(actor, hire, action, **meta)`: validate guards (actor role, payment state, acknowledgment presence) → lock where capacity-relevant → write → append event → `transaction.on_commit` side-effects. **The only write-path to `hires.status` in the codebase.**
- `hires/availability.py`: TSD §3.4 SQL — holding states = `confirmed`, `on_hire`, `accepted` with live `payment_deadline`; available iff `overlapping_holds < unit_count`. **`Requested` never holds dates.**
- **Race rule (binding):** `accept_hire` and `apply_payment_success` take `SELECT … FOR UPDATE` on the **listing row**, re-check availability, then write — one transaction. On entering Confirmed, the same transaction auto-declines overflowed Requested/Accepted hires (`no_longer_available`) and queues their notifications on commit.
- **Close the Wave 3 stub:** wire real availability into the search payloads — listing `available` flags and the yard-sheet "n of m free" caption data (`ux/02` S5) now compute via this engine. Remove the stub note from the search OpenAPI schema.
- Tests: every legal transition · every illegal transition rejected · guard failures · event appended per transition · the **threaded double-payment race test** (two concurrent payments, last unit ⇒ exactly one Confirmed, loser flagged for auto-refund) · availability matrix incl. unit_count > 1 and expired-window release.

### 4C — Request → Accept → Decline/Expire (FSD §7.1–§7.2)
- `POST hires` — dates, optional note, terms acknowledgment; preview computed via 4A (hirer sees **total only**, D-014); **Basic cap**: `hire_value > ₦250,000` ⇒ `basic_cap_exceeded` (FSD §4.1); blocked-date validation against availability.
- `POST :id/accept` — terms lock (immutable from here), `payment_deadline = now+4h`, payment initialized (4D), hire conversation auto-created (stub the messaging hook if Wave 5 absent — interface now, implementation then); operator/driver acknowledgment recorded when applicable (FSD §7.2).
- `POST :id/decline` (mandatory reason) · 24h expiry sweep · `POST :id/cancel` (role- and state-aware per FSD §7.6 table).
- `GET hires?role=&status=` · `GET hires/:id` (+`events[]` timeline). **D-014 serializer shaping: `service_fee`/`payout_amount` present iff `request.user == hire.supplier` or staff — tested both directions.**

### 4D — Paystack (TSD §3.6, D-006)
- Initialize on accept: amount = `hire_value`, `channels=["card","bank_transfer","ussd"]`, `reference=f"THR-{short_id}-{attempt}"`, metadata `hire_id`; ≤3 attempts inside the window; `GET :id/payment` returns status + authorization_url.
- `POST payments/webhook`: HMAC-SHA512 verify → `paystack_events` dedup on `event_id` (duplicate ⇒ 200 skip) → 200 fast → handler task calls **verify API** before `state.apply(system, hire, "pay")`. Client redirects never trusted.
- Refunds per FSD §7.6 (the six-row table is normative): >72h = 100% · ≤72h = value − one day's daily-equivalent (`hire_value/duration_days`, rounded to kobo) − ~1.5% processing, withheld day → supplier payout `due` · supplier-cancel = 100% to hirer + **strike** (3 ⇒ suspension review) · no-shows map per table. Paystack refund API, states tracked, failure ⇒ Ops alert.
- Tests: webhook idempotency (duplicate, out-of-order, replay) · signature rejection · verify-before-transition · refund math per table row · money invariant `collected − refunded − paid_out − retained_fee ≡ 0` asserted at every terminal state.

### 4E — Timers & sweeps (TSD §3.5, idempotent)
- Every-5-min sweep: Requested past 24h → Expired · Accepted past deadline → Cancelled(system, `payment_expired`) · Confirmed past start+24h → On Hire · On Hire past end+48h undisputed → Completed (+ payout `due`). Double-run = no-op (tested). Reminder jobs: supplier nudge at 20h; hirer 60-min payment warning (FSD §9).
- Handovers (FSD §7.4): `POST :id/handovers` (kind on_hire/off_hire, ≥2 photos → private bucket, class-appropriate reading: hour meter/odometer/none) · `POST handovers/:id/confirm` (counterparty). Non-blocking; absence = no-show evidence.
- Disputes: either party flags during On Hire or ≤72h after end → In Dispute, payout frozen. Resolution is an Ops action (Wave 6 surface; service function + tests now).

### 4F — Payouts, reconciliation, notifications
- Payout lifecycle `pending → due → paid | frozen`; created on completion — plus the one exception, the ≤72h-cancellation withheld-day payout (D-015); mark-paid records reference (Ops surface Wave 6, service now).
- Daily Paystack reconciliation task (ledger vs `payments`; mismatch ⇒ Sentry + Ops email). Zero-mismatch is a launch criterion.
- Notification matrix FSD §9, hire rows: badge + email per event; supplier email prefs honoured (badges always accrue); **hirer receipt shows no fee** (D-014). Includes the supplier-strike email (FSD §9 last row) fired when a supplier-cancel records a strike (manual Ops strikes reuse the same path in Wave 6).

## Out of scope (deferred)

- Deposits, Transfers/split payouts, extensions via `parent_hire` (Phase 2) · review system (Phase 2) · Ops dispute *UI* (Wave 6 — functions land here) · push (Phase 3).

## Contracts frozen at wave end

`hires/*`, `payments/webhook`, payment-status endpoint — **this freeze unblocks Waves 7 and 8 to start in parallel** (TSD §10 note). Treat it with corresponding care.

## Mandatory tests (gate: 85% on `hires` + `payments`)

Everything listed per slice, plus: E2E happy path in Paystack test mode (scripted, repeatable) · auto-decline of overflowed competitors on Confirmed · LockedTerms immutability (PATCH attempts on financials rejected at service *and* serializer layers) · D-014 leak test across **every** hire-touching serializer, including notification email bodies.

## Exit criterion (founder demo)

> **Five end-to-end hires on production in Paystack test mode**, exercising: best-price weekly win · fee floor (₦2,500) · payment-window expiry auto-cancel · ≤72h hirer cancellation with correct refund math · dispute freeze + resolution. Race + idempotency suites green in CI. Reconciliation runs with zero mismatches. The hire detail payload, fetched as hirer and as supplier, shows the D-014 difference.

## Wave-end checklist

- [ ] FSD §3.1 vectors + §7.6 refund rows are named tests
- [ ] `hire_events` UPDATE/DELETE revoked at DB level (verified in prod)
- [ ] OpenAPI regenerated & committed; **Wave 7/8 unblock announced**
- [ ] Founder approval recorded before Wave 5 begins
