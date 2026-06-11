# Wave 9 — Hardening & Launch Gate

**Status:** ⏸ Gated on Waves 0–8 sign-off (the full system exists; this wave makes it launchable)
**Depends on:** Everything. No new features land in this wave — scope is verification, resilience, operations, and the FSD §13 gate.
**Spec references:** FSD §11 (journeys as acceptance narratives) · §12 (NFRs) · §13 (launch acceptance — **the gate**) · TSD §7 (security) · §8 (pre-launch runbook) · §9 (observability, runbooks) · `ux/00` J1–J8 (executed verbatim, per its own preamble)

## Objective

Prove the system under load, attack, failure, and real operation — then walk the launch gate. The deliverable is not code; it is **evidence**: recorded measurements, executed runbooks, passing failure-scenario tests, and a founder who has operated the whole machine for a week without surprises.

## Workstreams

### 9.1 Journey verification (the UX contract, `ux/00`)
- Execute **J1–J8 verbatim** on production (Paystack test mode), each as a documented script with screenshots/recordings: J1 fleet onboarding <60 min · J2 install→request <10 min · J3 full handover loop · J4 all four unhappy paths · J5 storefront→multi-hire · J6 weekly fleet rhythm · J7 report→removal ladder · J8 two-tap re-hire.
- FSD §11.4 failure scenarios all pass **as automated tests** (they were built across Waves 4–6 — this wave audits the suite is complete and green): supplier-silent expiry · payment-window lapse · 5-days-out cancel · supplier cancel + strike · dispute freeze + resolution · 3-report removal.

### 9.2 Performance & load (FSD §12 numbers, measured not asserted)
- Map-path load test (the hot path): seeded dual-corridor data at realistic density; **P95 <500ms @ 500 in-radius listings** re-verified under concurrent load (locust or k6 from a second Railway service or local). Non-geo APIs <200ms P95 · webhook→state <60s · realtime <300ms P95 · app cold start <4s mid-tier Android · photo upload <5s/5MB on 4G.
- Railway resource headroom check under load (api 512MB / worker 256MB); **usage-cap response runbook** written and tested (TSD §9).

### 9.3 Security pass (TSD §7 audit)
- Checklist audit with evidence per item: HSTS · JWT rotation/blacklist · bcrypt cost · Fernet at rest (+ **key-rotation runbook executed once against a test record**) · presigned-GET expiry · webhook HMAC + replay rejection · throttles live in prod · CORS allowlist · admin 2FA + cookie path + IP logging · no secrets in clients (bundle string-scan) · dependency audit (pip-audit / pnpm audit) clean or triaged.
- Abuse drills: OTP flooding · login stuffing against lockout · presign abuse (wrong kind/size) · masked-contact bypass attempts (spaced/dotted numbers) · D-014 probing as hirer across every endpoint with a scripted scanner.
- NDPR sweep: consent copy live · soft-delete→30-day purge task verified with a test account · retention carve-outs (financial 7y, verification 5y) implemented in the purge logic.

### 9.4 Money correctness audit
- Reconciliation green for **14 consecutive days** (zero mismatches — FSD §13 requires zero unreconciled states).
- Invariant sweep across all historical test hires: `collected − refunded − paid_out − retained_fee ≡ 0` at every terminal state; `hire_events` UPDATE/DELETE revocation re-verified in prod.
- Paystack **live-mode** smoke: one real ₦ hire end-to-end (small amount), refunded, reconciled — the only live-money test before launch.

### 9.5 Observability & operations
- Sentry triage week: every error class either fixed or explicitly accepted with a note; release tagging on all four surfaces; alert rules (webhook failures, reconciliation mismatch, task-queue depth, Ably 70%).
- `docs/runbooks/` complete and **each executed at least once**: payout batch · refund handling · dispute resolution · key rotation · OpenFreeMap→Protomaps switch · Railway usage-cap response · DB restore from backup (do a real restore drill).
- Weekly digest verified with real numbers; `/readyz` checks all green in prod.

### 9.6 Beta onboarding & launch gate (FSD §13)
- Seed-the-corridors operation: recruit and onboard real suppliers toward **≥40 Live listings (≥25 construction, ≥15 port) and ≥8 storefronts with 3+ listings** — the founder does the calls; this wave provides the tooling (onboarding checklist friction fixes, an Ops "supply progress" view if needed).
- Beta cohort of hirers; supervised first hires; feedback loop into a triaged fix list (fixes land under this wave's bar: no new features, only hardening).
- **Launch gate review** — every FSD §13 line item checked with evidence: supply counts · product timings (supplier register→Live <1 day; hirer install→request <10 min; full loop unaided) · NFRs green · zero unreconciled payments · §11.4 scenarios green. The 60-day metrics (≥25 paid hires, ≥₦500k fees, ≥30% repeat) are tracked post-launch via the digest.

## Out of scope

- Any new feature, surface, or integration (a hardening wave that grows scope has failed) · Phase 2 items (deposits, transfers, reviews, push) — park discoveries in a Phase 2 backlog file.

## Exit criterion (founder decision)

> The **FSD §13 launch gate walks green in a single sitting**: you review the evidence pack (journey recordings, perf numbers, security checklist, 14-day reconciliation record, executed runbooks, supply counts) and make the go/no-go launch call. Anything red is either fixed or consciously accepted in writing.

## Wave-end checklist

- [ ] J1–J8 executed and recorded; §11.4 scenarios green in CI
- [ ] All FSD §12 numbers measured and recorded (not asserted)
- [ ] Security checklist evidenced; live-money smoke reconciled
- [ ] Every runbook executed once; restore drill done
- [ ] Launch go/no-go recorded by the founder — **Terminal ships**
