# Terminal — canonical TODO

Last reconciled: 2026-08-20  
Owner: Founder unless another owner is named  
Scope: active defects, launch gates, operational carry-overs, approved follow-ups, and explicitly deferred roadmap

This is the single backlog for the repository. It supersedes
`docs/TODO-backend-endpoints.md` and deduplicates open items from
`Implementations.md`, `docs/v2/DECISIONS.md`, wave checklists, runbooks, code
comments, CI, and the 2026-08-20 MVP readiness audits.

## How to use this file

- **P0 — pre-private-beta:** do not invite external paying users until closed or
  consciously accepted in writing.
- **P1 — pre-public-launch:** may be tolerated in a founder-supervised beta, but
  blocks an unrestricted launch.
- **P2 — improvement:** valuable and active, but does not block a supervised
  beta or public launch by itself.
- **Founder-gated roadmap:** not authorized implementation work. A separate
  founder decision/go is required.
- Close an item only with evidence: tests, a production probe, a recorded
  journey, an external-dashboard screenshot/reference, or an executed runbook.
- Log meaningful closures in `Implementations.md`; update the governing
  decision/spec when behaviour or contracts change.
- Never put credentials, secret values, demo passwords, or private account data
  in this file.

---

## P0 — before a private beta

### Security, identity, and legal

- [ ] **P0-SEC-001 — Rotate and remove plaintext production-test credentials.**
  Two tracked production-test scripts contain account credentials. Treat them
  as compromised: rotate passwords, invalidate sessions, replace literals with
  required environment variables, and assess git-history remediation. Do not
  copy the values into tickets or logs.
  - Source: `scripts/comprehensive_prod_test.py:16-21`,
    `scripts/wave4_prod_test.py:15-21`
  - Close with: rotated accounts + env-only scripts + secret scan over current
    tree/history.

- [ ] **P0-AUTH-001 — Wire the active-hire account-deletion guard.**
  `has_active_hires()` still returns `False` even though Wave 4 is shipped, so a
  party can soft-delete during a non-terminal hire.
  - Source: `backend/accounts/services/deletion.py:1-24`
  - Close with: non-terminal status query, role coverage, regression tests, and
    verified `active_hire_guard` API response.

- [ ] **P0-AUTH-002 — Use a shared production cache.**
  The login-failure lockout and other cache-backed controls use per-process
  `LocMemCache`; they do not hold consistently across multiple Gunicorn
  workers. Use the Postgres-backed Django cache required by D-010 and verify
  lockout across workers.
  - Source: `backend/settings/base.py:192-201`,
    `backend/accounts/services/login.py`
  - Close with: prod settings override, cache table migration/creation, and a
    multi-worker lockout test.

- [ ] **P0-LEGAL-001 — Publish and link Terms and Privacy.**
  Registration requires consent, but the portal/mobile consent labels are not
  links and the live `/terms`, `/privacy`, and `/legal` destinations returned
  404 on 2026-08-20. Publish the actual documents and align collect-only
  payment, cancellation, operator/driver liability, disputes, retention, and
  D-032 claims.
  - Source: `portal/app/(auth)/register/page.tsx:122-140`,
    `portal/app/(auth)/layout.tsx:37-48`,
    `mobile/app/auth/register.tsx:173-182`,
    `mobile/app/(tabs)/profile.tsx:162-171`
  - Close with: anonymous 200 responses, clickable consent links before
    acceptance, versioned consent evidence, and legal review.

- [ ] **P0-SEC-002 — Confirm a dedicated production field-encryption key.**
  Supplier bank details must not rely on a fallback derived from
  `SECRET_KEY`.
  - Source: `backend/core/encryption.py`, `backend/.env.example`
  - External owner: VPS/Infisical operator
  - Close with: dedicated `FIELD_ENCRYPTION_KEY` present and a documented
    encrypt/decrypt + rotation rehearsal against a test record.

### Money and production transaction

- [ ] **P0-PAY-001 — Point the Paystack dashboard webhook at the VPS API.**
  The transaction becomes Confirmed only through a verified webhook; repository
  code cannot prove the external dashboard setting.
  - Required URL:
    `https://terminal-api.lab.perblis.com/api/v1/payments/webhook`
  - Source: `DEPLOY.md:86-93`, `backend/payments/views.py:27-77`
  - External owner: Paystack dashboard owner
  - Close with: Paystack delivery log shows 200 and the corresponding hire
    reaches Confirmed without manual intervention.

- [ ] **P0-PAY-002 — Execute one real small-value Paystack lifecycle.**
  Run checkout → webhook → provider verification → Confirmed → cancellation →
  refund → reconciliation, then inspect the money invariant and Ops records.
  - Source: `docs/waves/wave-9.md:26-29`
  - Close with: redacted transaction references, refund completion, and zero
    reconciliation mismatch.

- [ ] **P0-PAY-003 — Remove dead payment-return defaults and verify prod env.**
  The code fallback still points at the retired Workers host. Confirm
  `PAYMENT_RETURN_BASE_URL`, `PAYSTACK_CALLBACK_URL`, and
  `FRONTEND_BASE_URL` use current VPS/product hosts, then remove stale defaults.
  - Source: `backend/settings/base.py:285-306`,
    `backend/.env.example`
  - Close with: initialized checkout carries the intended callback and returns
    to the installed app successfully.

### Onboarding, data integrity, and release proof

- [ ] **P0-ONB-001 — Prove real Termii SMS delivery.**
  Key presence in `/readyz` does not prove sender approval. Both channels are
  required for login, so the interim Ops channel-verification path is not a
  public onboarding solution.
  - Source: `backend/accounts/services/delivery.py:24-40`,
    `backend/accounts/integrations/sms.py`, `CLAUDE.md:44`
  - External owner: Termii account owner
  - Close with: a fresh Nigerian number receives and verifies the production
    OTP without Ops intervention.

- [ ] **P0-DATA-001 — Separate demo history from real market history.**
  Production contains invented Suppliers and simulated hires. Remove them
  before external launch or introduce durable provenance that excludes them
  from trust/reputation/launch metrics. Email-domain heuristics are not an
  acceptable permanent boundary.
  - Source: `backend/core/management/commands/seed_market.py`,
    `Implementations.md:927-933`,
    `docs/v2/TRUST_FOUNDATION_VISIBILITY_PLAN.md:193-223`
  - Close with: documented data policy, real-vs-demo isolation tests, and clean
    production metrics.

- [ ] **P0-REL-001 — Verify and deploy the intended production revision.**
  Production deploys are manual and historically lag `main`. Check the
  dedicated production checkout before deploying; do not assume the latest
  repository code is live.
  - Source: `DEPLOY.md:36-54`, `Implementations.md:967-973`
  - External owner: VPS operator
  - Close with: deployed SHA recorded, migrations/seed complete, loopback and
    public health checks green, and current storefront fields visible.

- [ ] **P0-REL-002 — Complete Wave 7 and Wave 8 exit demonstrations.**
  Record J1/J6 on the Supplier Portal and J2/J3/J8 on a physical Android device
  against production; capture cold-start and upload measurements; verify OTA on
  device; record founder sign-off.
  - Source: `docs/waves/wave-7.md:58-67`,
    `docs/waves/wave-8.md:66-75`,
    `docs/runbooks/app-release.md:164-214`
  - Close with: recordings, measurements, signed checklists, and Wave 7/8
    status reconciliation.

- [ ] **P0-COPY-001 — Remove trust overclaims already in the app.**
  Replace “Terminal protects both parties” and “Funds are on hold” with
  collect-only factual language approved in D-032/T0.
  - Source: `mobile/app/messages/[id].tsx:164-170`,
    `mobile/app/hires/[id].tsx:85-92`,
    `docs/v2/TRUST_FOUNDATION_VISIBILITY_PLAN.md:37-54`
  - Close with: approved copy plus prohibited-claim tests.

---

## P1 — before an unrestricted public launch

### Visible value and commercial completeness

- [ ] **P1-TRUST-001 — Implement visible trust slices T0–T2.**
  Complete the claims gate, Hirer decision/payment surfaces, and Supplier
  acceptance/fulfilment surfaces. Do not use “escrow”, “insured”,
  “guaranteed”, or unreviewed “protected” claims.
  - Source: `docs/v2/TRUST_FOUNDATION_VISIBILITY_PLAN.md:96-191`,
    D-032 in `docs/v2/DECISIONS.md`
  - Close with: copy approval, D-014-safe tests, Android walkthrough, and portal
    walkthrough.

- [ ] **P1-COMM-001 — Make the payable commercial total complete.**
  Operator/driver “Available (extra)” rates exist in specs while transactional
  pricing excludes line items; mobilisation, fuel, and delivery are not
  contract-grade totals. For launch, either require all mandatory costs in the
  listed rate or design a server-priced revised quote accepted before payment.
  - Source: `docs/v2/05_Asset_Spec_Schemas.md:24-38,62-72`,
    `docs/v2/06_FSD_v2.md:68-74`,
    `mobile/app/hire-request/[listingId].tsx`
  - Close with: founder decision, unambiguous listing/request copy, server-side
    total, and no payable amount negotiated outside the hire record.

- [ ] **P1-LIST-001 — Preserve or define listing terms used by active hires.**
  Live listing edits change the referenced listing while hires snapshot only
  financial/date fields. Decide which title/spec/location/operator terms are
  immutable transaction terms, snapshot them where required, and correct the
  portal claim that existing hires retain specs.
  - Source: `backend/listings/services/listings.py:137-176`,
    `backend/listings/tests/test_listings.py:160-162`,
    `portal/components/assets/asset-form.tsx:238-241`
  - Close with: documented snapshot boundary and tests showing a Live edit
    cannot rewrite an accepted hire’s evidence.

### Wave 9 evidence pack

- [ ] **P1-W9-001 — Execute J1–J8 verbatim on production.**
  - Source: `docs/waves/wave-9.md:13-15`
- [ ] **P1-W9-002 — Run and record load/performance gates.**
  Include map P95, non-geo P95, webhook latency, realtime latency, Android cold
  start, and 4G handover upload.
  - Source: `docs/waves/wave-9.md:17-19`
- [ ] **P1-W9-003 — Complete security and abuse drills.**
  Include HSTS/JWT/key rotation/presign/webhook/throttle/CORS/admin 2FA, OTP
  flooding, login stuffing, contact-mask bypass, dependency audits, client
  secret scan, D-014 endpoint scan, and NDPR purge.
  - Source: `docs/waves/wave-9.md:21-24`
- [ ] **P1-W9-004 — Record 14 consecutive clean reconciliation days.**
  Re-run the historical invariant sweep and DB-level `hire_events`
  UPDATE/DELETE enforcement check.
  - Source: `docs/waves/wave-9.md:26-29`
- [ ] **P1-W9-005 — Complete observability and runbook execution.**
  Triage Sentry, verify alerts and task-worker health, and execute every runbook
  once—including DB restore, Fernet rotation, map fallback, and capacity
  response.
  - Source: `docs/waves/wave-9.md:31-34`
- [ ] **P1-W9-006 — Recruit real supply and run the beta gate.**
  Meet the FSD target with real Suppliers: at least 40 Live listings across the
  approved corridors and eight storefronts with three or more listings; run
  supervised first hires and record the go/no-go.
  - Source: `docs/waves/wave-9.md:36-47`,
    `docs/v2/06_FSD_v2.md:259-263`

### Production, operations, and CI

- [ ] **P1-OPS-001 — Make readiness describe the active integrations.**
  `/readyz` checks Bachs but omits the active Paystack provider and LocationIQ;
  key presence also does not prove upstream health. Add provider-aware status
  and retain a separate non-destructive operational smoke.
  - Source: `backend/core/health.py:44-59`,
    `backend/settings/base.py:287-311`

- [ ] **P1-OPS-002 — Monitor worker and scheduled-task health.**
  Webhook completion depends on `db_worker`; cron drives sweeps,
  reconciliation, purges, digest, and backups. Add queue-depth/staleness alerts
  and verify `/var/log/terminal-cron.log`.
  - Source: `infra/vps/docker-compose.prod.yml`,
    `infra/vps/terminal.cron`

- [ ] **P1-OPS-003 — Complete and execute missing runbooks.**
  Add DB restore, Fernet key rotation, OpenFreeMap→Protomaps, resource/capacity
  response, and integration outage procedures.
  - Source: `docs/waves/wave-9.md:31-34`, `docs/runbooks/`

- [ ] **P1-OPS-004 — Replace the NDPR purge shell snippet with a command.**
  Add an idempotent management-command wrapper and operational test.
  - Source: `infra/vps/terminal.cron:13-15`

- [ ] **P1-OPS-005 — Verify one-time handover-photo migration.**
  Run `migrate_handover_photos --dry-run`, then migrate if legacy public
  handover objects exist.
  - Source:
    `backend/hires/management/commands/migrate_handover_photos.py`,
    D-025

- [ ] **P1-CI-001 — Disconnect the retired Cloudflare Workers build.**
  It posts a permanent false-red check despite the D-027 VPS cutover.
  - Source: `Implementations.md:909,973`, `CLAUDE.md:32`
  - External owner: Cloudflare/GitHub administrator

- [ ] **P1-CI-002 — Protect `main` and restore trustworthy CI gating.**
  Require current backend/mobile/portal checks; monitor portal E2E rather than
  relying on stale failures.
  - Source: `Implementations.md:909,973`, `.github/workflows/`
  - External owner: GitHub administrator

- [ ] **P1-CI-003 — Add dependency-update/audit automation.**
  Add Dependabot or a documented equivalent and make `pip-audit`/`pnpm audit`
  triage part of Wave 9.
  - Source: `docs/waves/wave-9.md:21-24`

- [ ] **P1-DOC-001 — Reconcile stale handoff and wave documentation.**
  Remove active-status claims about Railway auto-deploy, Cloudflare portal
  hosting, missing LocationIQ/Ably, stub availability, and Wave 8 gating where
  code/live evidence has superseded them. Historical log entries remain
  append-only.
  - Source: `Implementations.md` Current status,
    `docs/waves/README.md`, `CLAUDE.md:30-45`

- [ ] **P1-REL-001 — Make mobile distribution reproducible.**
  Restore or replace the discarded APK publish script, verify the runtime
  version/channel/project three-way match on a physical device, create the
  production channel when needed, and complete iOS distribution.
  - Source: `Implementations.md:919-925,983-989`,
    `docs/runbooks/app-release.md`

- [ ] **P1-REL-002 — Cut over from lab to product domains.**
  Update ingress, allowed hosts/CORS, payment return, API URL, Paystack
  dashboard, mobile OTA, legal links, and public support references together.
  - Source: `infra/vps/README.md:43-50`, `DEPLOY.md:86-93`

---

## P2 — active improvements

### Backend and contracts

- [ ] **P2-API-001 — Add a server-priced listing quote endpoint.**
  `GET /api/v1/listings/{id}/quote?start=…&end=…`; replace the S7 client
  estimate with server truth before submission.
  - Source: former `docs/TODO-backend-endpoints.md`,
    `mobile/lib/pricing.ts`, `mobile/app/hire-request/[listingId].tsx`

- [ ] **P2-API-002 — Add yard-scoped hire statistics.**
  Extend `GET /api/v1/hires/stats` with `yard_id` or a `by_yard` block.
  - Source: former `docs/TODO-backend-endpoints.md`,
    `backend/hires/services.py:277-298`

- [ ] **P2-API-003 — Add payout day-series.**
  Provide a server series for the dashboard earnings trend.
  - Source: former `docs/TODO-backend-endpoints.md`

- [ ] **P2-API-004 — Add supplier-facing Hirer card fields.**
  Provide the approved name/account-level/completed-hire shape without leaking
  unrelated identity data.
  - Source: `backend/hires/serializers.py:68-142`,
    historical founder-approval queue in `Implementations.md`

- [ ] **P2-API-005 — Add search price sort and a result count.**
  Preserve cursor stability and regenerate the frozen-contract OpenAPI
  additively.
  - Source: `Implementations.md:951-965`,
    former `docs/TODO-backend-endpoints.md`

- [ ] **P2-API-006 — Move text matching into Postgres with relevance.**
  Replace full-radius Python scans with `tsvector`/`pg_trgm` when load evidence
  warrants the pagination/ranking contract change.
  - Source: `backend/search/services/text.py`,
    `Implementations.md:959-965`

- [ ] **P2-API-007 — Use server-side portal filtering/pagination at scale.**
  Remove the 2,000-row full cursor walk before large fleets onboard.
  - Source: `portal/lib/queries.ts`, former
    `docs/TODO-backend-endpoints.md`

- [ ] **P2-API-008 — Publish the storefront response schema.**
  Replace the OpenAPI “200: no response body” gap with an explicit serializer
  before further consumers depend on additive storefront fields.
  - Source: `Implementations.md:999-1005`,
    `backend/openapi/schema.yml`

- [ ] **P2-BE-001 — Implement or formally retire the orphan-photo sweep.**
  The task is a logged no-op without an upload ledger/lifecycle policy.
  - Source: `backend/listings/tasks.py:11-23`

- [ ] **P2-BE-002 — Decide “Other (describe)” asset-type handling.**
  Implement the specified Ops review queue or change the product spec to the
  current reject-only behaviour.
  - Source: `docs/waves/wave-2.md`, `backend/listings/errors.py`

- [ ] **P2-BE-003 — Extend static typing into money/state modules.**
  Add hires, payments, messaging, and ops incrementally to the mypy CI gate.
  - Source: `.github/workflows/backend.yml:59-60`

- [ ] **P2-BE-004 — Add an Ops dispute-context message view if needed.**
  Original message bodies are retained, but the service remains parties-only.
  Confirm the existing admin workflow before adding staff access.
  - Source: `backend/messaging/services.py:46-59`

### Product, UX, and content

- [ ] **P2-UX-001 — Fix email OTP channel copy.**
  The email body says “verify your phone”; change it to email.
  - Source: `backend/accounts/integrations/email.py:81-89`

- [ ] **P2-UX-002 — Add a small map/list thumbnail variant.**
  Full listing JPEGs remain oversized for 88×66 list/map thumbnails.
  - Source: `Implementations.md:935-941`

- [ ] **P2-UX-003 — Reconcile map and design-system artifacts.**
  Move the portal map to shared `packages/tokens/map/grade.json`, bake
  `terminal-chart-{light,dark}.json`, and reconcile D-028 design-system
  chapters with the dark portal.
  - Source: D-022/D-028 in `docs/v2/DECISIONS.md`,
    `portal/components/map/map-view.tsx`,
    `packages/tokens/map/snapshot-style.mjs`

- [ ] **P2-UX-004 — Add structured Ops-verified warehousing compliance.**
  Founder-marked MUST DO. First fix template version immutability and the portal
  multi-select, then design the Ops review/claim lifecycle.
  - Source: `docs/v2/DECISIONS.md` Open items,
    `Implementations.md:999-1005`

- [ ] **P2-UX-005 — Restore the portal reset-password completion page.**
  Confirm whether the existing email reset flow has a usable portal landing
  page; implement if the historical stashed page never landed.
  - Source: `Implementations.md` password-reset handoff entry

- [ ] **P2-UX-006 — Resolve search presentation niceties.**
  Decide the dual meaning of `badge`; optionally add class data to ClusterPin,
  `yard_name`/`asset_type` to list rows, and improve the generic search
  placeholder.
  - Source: `backend/search/services/common.py`,
    `mobile/components/map/pins.tsx`,
    `Implementations.md:951-1005`

- [ ] **P2-TRUST-001 — Add provenance-clean transaction reputation (T3).**
  Show only paid Completed real hires and only after P0-DATA-001 is closed.
  - Source: `docs/v2/TRUST_FOUNDATION_VISIBILITY_PLAN.md:193-223`

- [ ] **P2-TRUST-002 — Build a portable authenticated hire record (T4).**
  Preserve role-shaped money and private evidence authorization.
  - Source: `docs/v2/TRUST_FOUNDATION_VISIBILITY_PLAN.md:225-240`

- [ ] **P2-METRIC-001 — Add funnel/cohort reporting when optimization starts.**
  Measure enquiry→request→accept→Confirmed, handover completion, and repeat
  paid hires without using Sentry as product analytics.
  - Source: `docs/v2/TRUST_FOUNDATION_VISIBILITY_PLAN.md:242-259`

---

## Founder-gated roadmap — do not start without approval

These are intentional deferrals, not launch defects.

### Phase 2

- [ ] Automated Paystack transfers/split payouts.
- [ ] Security deposits/card holds and deposit-aware cancellation.
- [ ] Big-ticket marginal fee taper or cap (D-003).
- [ ] Hire extensions/modifications using `parent_hire`.
- [ ] Per-unit availability blocks (D-024 currently blocks whole listings).
- [ ] Rate-table configuration UI/database model.
- [ ] Revisit split fees or Hirer-side fees only with D-005 reconsideration.
- [ ] **Hourly hire pilot only after transaction evidence (D-031):** prepaid,
  fixed-duration scheduling; no open-ended meter billing.

### Phase 3

- [ ] NIN/BVN/CAC API verification.
- [ ] Push notifications.

### Phase 4

- [ ] Reviews and ratings.
- [ ] Scalable dispute-mediation tooling.

### Later expansion

- [ ] Supplier analytics and demand heatmaps.
- [ ] Featured listings, subscriptions, and monetisation beyond Service Fees.
- [ ] Expansion beyond the founder-approved Lagos corridors.

Primary roadmap sources: `docs/v2/03_MVP_Scope.md`,
`docs/v2/DECISIONS.md`, `docs/v2/07_TSD.md`, and
`docs/waves/wave-9.md`.

---

## Reconciled findings that are not active TODOs

Do not re-add these without fresh contrary evidence:

- Listing availability ranges and private handover photo display URLs shipped
  after the old endpoint backlog was written.
- `LOCATIONIQ_KEY` and `ABLY_API_KEY` appeared configured in the live
  `/readyz`/geocode probes on 2026-08-20; functionality still belongs in normal
  release verification, but “unset” is a stale handoff claim.
- Recent portal E2E and main backend/mobile workflows were green; monitor them,
  but do not describe portal E2E as permanently failing.
- The portal `border-border` sweep and the `seed_market`/media fixes are present
  on current `origin/main`; older log entries saying otherwise are historical.
- Railway and Cloudflare Workers are not deployment targets after D-027. The
  remaining Cloudflare Git check and stale callback URL are active cleanup
  items above; rebuilding the retired hosts is not.

## Closure checklist

When completing an item:

1. Update `[ ]` to `[x]` and append `— closed YYYY-MM-DD, <evidence>`.
2. Add or update automated tests where behaviour changed.
3. Regenerate `backend/openapi/schema.yml` for API contract changes.
4. Execute the relevant production or device verification.
5. Append the meaningful change to `Implementations.md`.
6. Update `docs/v2/DECISIONS.md` only when a founder decision changes.
