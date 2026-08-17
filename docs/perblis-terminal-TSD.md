---
document_type: TSD
project: Terminal
version: 2.1
status: canonical
supersedes: docs/v2/07_TSD.md
authority: architecture, data model, integrations and contract shape
---

# TERMINAL — Technical Specification Document v2.1

v2.1 · June 2026 · Implements the canonical FSD under the ratified decisions D-001…D-031
Status: ✅ Canonical reference edition for development

This file is the canonical TSD (D-031). It supersedes `docs/v2/07_TSD.md`, which now
points here. **Section numbers are unchanged** — a citation of the form `TSD §3.4`
resolves against the numbered sections below exactly as before. The requirement layer
(`T-###`) added above them is new; it labels the same technical shape for traceability
and does not restate or amend it. Where the two could be read differently, **the
numbered section wins** and the difference is a defect to fix.

Authority: [docs/perblis-terminal-FSD.md](perblis-terminal-FSD.md) owns behaviour, this
document owns technical shape, [DECISIONS.md](../DECISIONS.md) owns ratified intent, and
[design.md](../design.md) owns engineering invariants and the Definition of Done.
**Delivery sequencing lives only in [docs/waves/README.md](waves/README.md)** — §10 below
is a pointer, not a second schedule.

**Stack (D-009…D-013, hosting per D-027):** Django 6.0.x · DRF 3.17 · PostgreSQL 17 +
PostGIS 3.5 · django-tasks · Ably · **self-hosted VPS under Docker Compose** · Cloudflare
R2 · MapLibre GL / OpenFreeMap / LocationIQ · Next.js (containerised) · React Native +
Expo · Paystack · Termii · Resend · Sentry. Budget ceiling: **$25/month** total.

## Technical requirements

### T-001 — System topology and deployment

- **Purpose:** run the four surfaces and their data on one owner-controlled host, inside the budget ceiling and with no public port exposure.
- **Realizes:** F-021, F-022, F-023, F-024.
- **Design:** the Django api (gunicorn), the django-tasks worker, PostGIS 17-3.5 and the containerised Supplier Portal run as one Docker Compose project (`infra/vps/docker-compose.prod.yml`) bound to loopback behind the host's nginx ingress with Let's Encrypt TLS (D-027, superseding D-012's Railway + Cloudflare Workers hosting). R2 holds public listing media and private verification and handover objects; Ably is realtime fan-out; Sentry covers all four surfaces. **No Redis anywhere** (D-010) — the database is the broker, the queue and the source of truth. §1's diagram documents the superseded Railway topology and is retained for history.
- **Interfaces/contracts:** `https://terminal-api.lab.perblis.com` and `https://terminal.lab.perblis.com`; loopback `127.0.0.1:8100` (api) and `:8101` (portal); product domains are a documented one-line-per-environment switch.
- **Invariants and failure handling:** **merging to `main` ships nothing** — deployment is one idempotent manual step, `infra/vps/deploy.sh`, run against the dedicated production checkout at `/opt/terminal/repo`; static is baked at image build; periodic jobs run from `/etc/cron.d/terminal`; a nightly `pg_dump` to `/var/backups/terminal` with 14-day retention replaces the platform's implicit backups.
- **Security/data considerations:** no container publishes a public port — Docker bypasses the host firewall, so exposure is decided by the ingress alone; secrets live in `/opt/terminal/.env` and never in the repository.
- **Verification:** `/healthz` and `/readyz` green after a deploy; the deploy script's own health check gates the roll.
- **Dependencies:** D-010, D-012, D-013, D-027.
- **Risks:** RK-001 — production routinely lags `origin/main`, so a deploy ships every intervening merge; always read `git -C /opt/terminal/repo log -1` first.

### T-002 — Repository layout and environment configuration

- **Purpose:** keep one monorepo whose boundaries match the app boundaries, configured entirely from the environment.
- **Realizes:** F-024.
- **Design:** the §2.1 tree — `backend/` (per-app packages), `portal/`, `mobile/`, `packages/tokens/`, `docs/`, `infra/`, root `design.md`. Configuration is django-environ with `settings/{base,dev,prod,test}.py`.
- **Interfaces/contracts:** the §2.2 variable table; `.env.example` is exhaustive and CI-checked.
- **Invariants and failure handling:** an absent third-party key degrades to a console or log fallback and **never crashes** — except phone OTP delivery, which fails loudly in production by design (F-005).
- **Security/data considerations:** secrets come only from the platform environment; `FIELD_ENCRYPTION_KEY` is the Fernet key protecting bank numbers; no secret is ever written to the repository or printed.
- **Verification:** CI asserts `.env.example` completeness; settings import cleanly per environment.
- **Dependencies:** T-001.
- **Risks:** RK-002 — `LOCATIONIQ_KEY` and `ABLY_API_KEY` are unset in production today (E-002, E-003), so geocode returns empty and realtime runs on polling.

### T-003 — Continuous integration and delivery

- **Purpose:** gate every merge on the checks that protect money, contracts and lexicon.
- **Realizes:** F-024.
- **Design:** path-filtered GitHub Actions — backend (ruff lint and format, loose mypy, pytest against a PostGIS service container) and portal (eslint, tsc, build, Playwright smoke).
- **Interfaces/contracts:** coverage gates of 85% on `hires` and `payments` and 70% overall are enforced in CI, not advisory.
- **Invariants and failure handling:** CI green is necessary but not sufficient — deployment remains a separate manual act (T-001). A permanently-failing external `Workers Builds: terminal-portal` check is a dead integration, not a repository gate (E-005).
- **Security/data considerations:** no production secret is available to CI; tests run against ephemeral containers.
- **Verification:** `pytest --cov` locally reproduces the CI gates; `pnpm build` reproduces the portal gate.
- **Dependencies:** T-002.
- **Risks:** RK-003 — the dead Workers Builds check trains reviewers to ignore red marks on pull requests.

### T-004 — Backend app boundaries and the service layer

- **Purpose:** keep domain logic testable, importable and out of the request cycle.
- **Realizes:** F-001…F-023.
- **Design:** the §3.1 ownership table — `core accounts suppliers listings search hires payments messaging ops`. All writes flow through `services.py` functions taking `(actor, …)`; the state machine, fee engine and availability check are pure and unit-tested in isolation.
- **Interfaces/contracts:** views and serializers call services; services never import views.
- **Invariants and failure handling:** **views and serializers never mutate domain state**; signals carry no business logic; side-effects dispatch through `transaction.on_commit`, so a failed email cannot roll back a state change and a committed change cannot lose its side-effect silently.
- **Security/data considerations:** permission classes (`IsSupplier`, `IsHirer`, `IsVerified`) live in `core` so authorization is uniform.
- **Verification:** service functions are unit-tested without HTTP; a grep for state assignment outside the machine returns nothing.
- **Dependencies:** T-006, T-008.
- **Risks:** RK-004 — business logic drifting into serializers is the most likely erosion of this boundary.

### T-005 — Money representation and the fee engine

- **Purpose:** compute and store money without drift.
- **Realizes:** F-001, F-003.
- **Design:** all amounts are **integer kobo** in `BigIntegerField`; `core.money` provides `kobo`, `naira` and `display`; `hires/fees.py` holds the pure `price_hire` implementation and the per-mille rate table of §3.2.
- **Interfaces/contracts:** `Price(scheme, hire_value, service_fee, payout_amount, fee_basis)`.
- **Invariants and failure handling:** no floats and no Decimals in domain logic; naira is never stored; kobo is never displayed; ties in the best-price rule resolve to the longer scheme.
- **Security/data considerations:** none beyond correctness — the fee basis string is supplier-facing and must not leak to hirers (T-011).
- **Verification:** the FSD §3.1 worked examples are the canonical test vectors, plus hypothesis property tests for monotonicity, the floor and `service_fee + payout_amount ≡ hire_value`.
- **Dependencies:** T-004.
- **Risks:** RK-005 — a future rate change must not touch existing hires; the rate table moving to the database is a Phase 2 hook, not an MVP lever.

### T-006 — Persistent data model

- **Purpose:** hold the transaction record and everything that supports it.
- **Realizes:** F-002…F-019.
- **Design:** the §3.3 table definitions, all UUIDv7 primary keys with timestamps, including the availability hot-path index `(listing, status, start_date, end_date)` and the GIN index on `specs` for ★ filters.
- **Interfaces/contracts:** migrations are reversible; app ownership of tables follows §3.1.
- **Invariants and failure handling:** `hire_events` is **append-only** — the application role has UPDATE and DELETE revoked and the admin is read-only; hires PROTECT their listing; a listing with hire records can never be hard-deleted.
- **Security/data considerations:** bank account numbers are Fernet-encrypted at rest; OTP codes are HMAC-hashed with no plaintext retained; NDPR carve-outs retain financial records 7 years and verification documents 5 years, with handover photos on the D-026 90-day window.
- **Verification:** migration up and down runs clean; the append-only guarantee is asserted by test.
- **Dependencies:** T-004, T-005.
- **Risks:** RK-006 — `spec_templates` upserts on `(asset_class, asset_type, version)`, so adding a field without bumping the module `VERSION` silently mutates a published template (O-001).

### T-007 — Availability and the concurrency contract

- **Purpose:** never sell the same unit twice.
- **Realizes:** F-013, F-014.
- **Design:** §3.4's counting query over holding states, folded into a bulk `availability_map` for search and a per-day `free_units_by_day` for the public calendar; supplier date-blocks add one indexed query and act as a hard hold on the whole listing (D-024).
- **Interfaces/contracts:** `GET /listings/{id}/availability?from=&to=` returns per-day free-unit counts only, capped at a 90-day window; `/search/map` and `/search/list` accept optional `date_from` and `date_to`.
- **Invariants and failure handling:** **the race rule is binding** — `accept_hire` and `apply_payment_success` open a transaction, take `SELECT … FOR UPDATE` on the listing row, re-check availability, then write. Two concurrent payments on the last unit cannot both pass; the loser is refunded in full and notified. Entering `confirmed` auto-declines overflowed hires in the same transaction and queues their notifications on commit.
- **Security/data considerations:** the availability endpoint returns counts only and never exposes counterparty data.
- **Verification:** a threaded double-payment test on the last unit; the availability map matches the per-day calendar for the same range.
- **Dependencies:** T-006, T-008.
- **Risks:** RK-007 — any new capacity-consuming write that skips the row lock reintroduces overbooking.

### T-008 — Hire state machine and scheduled sweeps

- **Purpose:** make every status change legal, logged and recoverable.
- **Realizes:** F-016, F-015, F-017, F-018.
- **Design:** `hires/state.py` holds `TRANSITIONS` plus per-transition guards; `apply(actor, hire, action, **meta)` validates, locks where capacity-relevant, writes, appends the `HireEvent`, then dispatches side-effects on commit. Sweeps run every 5 minutes on django-tasks; reconciliation daily; the metrics digest weekly.
- **Interfaces/contracts:** `hires/state.py::apply()` is **the only writer of hire status**.
- **Invariants and failure handling:** every task is idempotent, so re-running a sweep is a no-op and a missed run self-heals; no state is written without its event.
- **Security/data considerations:** the actor kind (user, system, ops) is recorded on every event, which is what makes the log usable as dispute evidence.
- **Verification:** every legal and illegal transition is covered; sweeps are asserted idempotent by double-run.
- **Dependencies:** T-004, T-006, T-007.
- **Risks:** RK-008 — a direct `.status =` assignment anywhere outside the machine silently destroys the audit trail.

### T-009 — Payment gateway integration

- **Purpose:** collect money and confirm it from a source the client cannot forge.
- **Realizes:** F-002, F-018.
- **Design:** the provider is **pluggable behind `payments.gateway`** (`PAYMENT_PROVIDER=paystack|bachs`, Paystack default per D-018); the Bachs adapter is retained, not deleted, so the choice can flip without code change. Paystack speaks integer kobo natively.
- **Interfaces/contracts:** initialize on accept with `amount=hire_value`, `metadata={hire_id}` and our own reference; `POST /api/v1/payments/webhook` verifies `x-paystack-signature` as HMAC-SHA512 of the raw body, dedups on the event, returns 200 fast and processes in a task; refunds issue per FSD §7.6.
- **Invariants and failure handling:** **verify before transition** — the handler calls the provider's verify endpoint and requires a matching status, amount and currency before `state.apply`; client redirects are never trusted; duplicate webhook deliveries are skipped idempotently.
- **Security/data considerations:** the webhook secret and API key live only in the environment; no card data ever touches Terminal.
- **Verification:** duplicate, out-of-order and replayed events are covered by test; five end-to-end test-mode hires form the wave exit criterion.
- **Dependencies:** T-006, T-008, T-002.
- **Risks:** RK-009 — the production dashboard webhook URL is a deploy-only carry-over that has not been confirmed set (E-006); without it, hires never reach Confirmed in production.

### T-010 — Search and map aggregation

- **Purpose:** answer the map's question in one server round-trip, authoritatively.
- **Realizes:** F-011, F-012.
- **Design:** §3.7's `GET /api/v1/search/map` aggregates yards **server-side** over Live listings and rides summaries along so the Yard Sheet opens without another request; `search/list` supports `group_by=asset|location` with keyset cursor pagination; distance is PostGIS `ST_Distance` on geography; ★ spec filters use JSONB containment and range over the GIN index.
- **Interfaces/contracts:** the §3.7 response shape; `GET /api/v1/geocode` proxies LocationIQ server-side with a 24-hour cache so the key never leaves the server.
- **Invariants and failure handling:** counts are computed by the server and are authoritative; the endpoint is N+1-free; a missing geocode key returns empty results rather than erroring.
- **Security/data considerations:** the search surface is public, so it must expose no supplier-confidential figures.
- **Verification:** solo, yard, filtered and zero-match cases; P95 measured at ~170ms on 500 listings.
- **Dependencies:** T-006, T-007.
- **Risks:** RK-010 — client-side clustering of returned pins must never re-derive counts the server already owns.

### T-011 — API conventions and endpoint inventory

- **Purpose:** make the contract the handshake between backend and every consuming surface.
- **Realizes:** F-004…F-023.
- **Design:** everything under `/api/v1/`, drf-spectacular schema published at `/api/docs/`, cursor pagination on lists, and the §3.8 endpoint inventory.
- **Interfaces/contracts:** the error envelope is `{"error":{"code","message","fields?"}}` with stable codes — `availability_conflict`, `verification_required`, `basic_cap_exceeded`, `payment_window_expired`, `block_invalid_range`; auth is a bearer access token with rotating refresh and blacklist; throttles are anon search 60/min, auth 120/min, OTP send 3/h/phone, login 5/15min/IP, report 5/day/user.
- **Invariants and failure handling:** **a module's schema is published and reviewed before its consuming wave starts**; contracts frozen at a wave's end are breaking-change-locked and changing one requires owner sign-off; `backend/openapi/schema.yml` is regenerated and committed whenever a contract changes.
- **Security/data considerations:** **the Hire serializer is role-shaped (D-014)** — `service_fee` and `payout_amount` are present only for the supplier or staff, enforced in the serializer layer with tests rather than left to clients.
- **Verification:** schema regeneration produces no diff when contracts are unchanged; D-014 shaping is asserted by test.
- **Dependencies:** T-004, T-006.
- **Risks:** RK-011 — a hirer-facing serializer gaining a fee field is a silent policy breach, not a visible bug.

### T-012 — Media pipeline

- **Purpose:** move large files directly to object storage without proxying bytes through the API.
- **Realizes:** F-006, F-008, F-017.
- **Design:** `POST media/presign` validates kind, content-type and size cap and returns a key plus a presigned PUT; the client uploads directly to R2 and attaches the key through the owning endpoint. The portal reaches presign and public media through its BFF proxy.
- **Interfaces/contracts:** kinds are `listing_photo`, `avatar`, `logo`, `verification_doc`, `handover_photo`.
- **Invariants and failure handling:** a weekly orphan sweep deletes unattached keys older than 7 days; the handover-photo purge (D-026) is a separate idempotent daily sweep with the `photos_purged_at` marker.
- **Security/data considerations:** verification documents and handover photos live in the **private** bucket and are served only as 15-minute presigned GETs minted where participants-only access is already enforced (D-025); there is no key-to-ownership oracle endpoint.
- **Verification:** a private object is unreachable without a presigned URL; the purge sweep is idempotent.
- **Dependencies:** T-002, T-006.
- **Risks:** RK-012 — presigned URLs embedded in a cached response outlive their intended audience if the cache is shared.

### T-013 — Contact masking implementation

- **Purpose:** implement the leakage posture without surveillance.
- **Realizes:** F-019.
- **Design:** on message create, Nigerian phone patterns and email addresses are matched and written to `body_masked` **alongside** the retained original `body`.
- **Interfaces/contracts:** serving rule — hire conversations serve `body` once the hire has ever reached Confirmed, enquiry conversations always serve `body_masked`.
- **Invariants and failure handling:** masking happens at **write time**, so a serving bug cannot retroactively expose contact details that were never stored masked.
- **Security/data considerations:** the original body is retained for Ops and dispute visibility; no keyword surveillance beyond this pattern, deliberately.
- **Verification:** masking on and off conditions are covered by test, including that an enquiry conversation never unmasks.
- **Dependencies:** T-006, T-008.
- **Risks:** RK-013 — pattern coverage is a trade-off; broadening it toward general surveillance would breach the stated privacy posture.

### T-014 — Realtime fan-out

- **Purpose:** deliver messages and badge changes live, without becoming a dependency for correctness.
- **Realizes:** F-019, F-020.
- **Design:** `core/realtime.py` publishes over the Ably REST API inside `transaction.on_commit` and mints HMAC-signed token requests scoped to the caller's own `conv:` and `user:` channels.
- **Interfaces/contracts:** `GET /api/v1/realtime/token`; channels `conv:{conversation_id}` and `user:{user_id}`.
- **Invariants and failure handling:** **Postgres rows are the message of record and Ably is fan-out only** — with no key configured the system degrades to 15-second polling with no message loss.
- **Security/data considerations:** token capabilities are scoped per caller, so a token cannot subscribe to another user's channels.
- **Verification:** an outage degrades to polling without loss; token scoping is asserted by test.
- **Dependencies:** T-006, T-008, T-002.
- **Risks:** RK-014 — free-tier limits of 200 concurrent connections and 6M messages need an alert at 70% through the weekly digest.

### T-015 — Supplier Portal architecture

- **Purpose:** serve the supplier surface with server-held credentials.
- **Realizes:** F-022.
- **Design:** Next.js 15 App Router, containerised on the VPS (D-027); Tailwind with **bespoke token-driven components** (D-019, refined by D-020's headless allowlist, palette per D-028); TanStack Query; react-hook-form with zod mirroring DRF validation; MapLibre for pins.
- **Interfaces/contracts:** **BFF auth** — `/auth/*` route handlers proxy DRF and store access and refresh JWTs in `httpOnly Secure SameSite=Lax` cookies; all data calls go through `/bff/*`, which adds the bearer token; media uploads and public media reads also ride the BFF proxy.
- **Invariants and failure handling:** **browser JavaScript never sees a token**; a 401 triggers a single-flight refresh rather than a stampede.
- **Security/data considerations:** the CORS allowlist names the portal origin; bank details render masked; the portal is dark-only (D-028).
- **Verification:** vitest covers BFF refresh logic; one Playwright smoke covers login → create listing → accept hire.
- **Dependencies:** T-011, T-001.
- **Risks:** RK-015 — token handling is the one place where a client-side convenience would breach the model outright.

### T-016 — Hirer app architecture

- **Purpose:** serve the hirer surface on a phone with a usable offline posture.
- **Realizes:** F-021.
- **Design:** Expo with TypeScript strict, expo-router, TanStack Query plus Zustand, tokens in SecureStore, NativeWind from `packages/tokens`, and `maplibre-react-native` against the OpenFreeMap style with the Terminal Chart grade (D-022) and plate markers (D-023).
- **Interfaces/contracts:** payment opens the gateway authorization URL in a web browser session and **polls hire status on return**, because the webhook is truth.
- **Invariants and failure handling:** tile cache plus a persisted query cache render My Hires and Messages cold; mutations require connectivity **except handover capture** (D-016), which queues photos locally and submits on reconnect.
- **Security/data considerations:** tokens live in SecureStore, never in async storage; the app uses native fetch and is not subject to the CORS allowlist.
- **Verification:** unit tests for the price-preview and countdown hooks; Journeys 2 and 3 on a device.
- **Dependencies:** T-011, T-010.
- **Risks:** RK-016 — the offline handover exception is the only allowed offline mutation; widening it would break the availability contract.

### T-017 — Security and compliance implementation

- **Purpose:** implement FSD §12's security and NDPR posture concretely.
- **Realizes:** F-024, F-005, F-006.
- **Design:** §7's controls — HTTPS with HSTS, bcrypt cost 12, Fernet bank-number encryption with a documented rotation procedure, 15-minute private presigned GETs, webhook HMAC with event dedup, the CORS allowlist, the §3.8 throttles, and a staff-only admin behind django-otp TOTP.
- **Interfaces/contracts:** the audit surface is the append-only `hire_events` table plus Django `LogEntry`.
- **Invariants and failure handling:** **simulate integrations, never simulate trust** — a missing key degrades to a log or console fallback, and no environment auto-verifies a user or auto-pays a hire.
- **Security/data considerations:** NDPR — consent copy at registration, soft delete with a 30-day purge task, and retention carve-outs of 7 years financial, 5 years verification documents, and the D-026 90-day handover-photo window.
- **Verification:** the purge task honours every carve-out; the admin is unreachable without a second factor.
- **Dependencies:** T-006, T-012, T-002.
- **Risks:** RK-017 — dependency patching within 72 hours is a stated commitment that needs an owner, not just a Dependabot schedule.

### T-018 — Testing strategy

- **Purpose:** put the mandatory suites where the money and the state live.
- **Realizes:** F-024 and every money or state requirement.
- **Design:** pytest with factory-boy, freezegun and hypothesis. Mandatory suites per §8 — fee engine, availability including the row-lock race, the state machine's legal and illegal transitions, webhook idempotency, sweep idempotency, refund math per §7.6 row, D-014 serializer shaping, and masking conditions.
- **Interfaces/contracts:** coverage gates of 85% on `hires` and `payments` and 70% overall.
- **Invariants and failure handling:** the suite is green before a slice is considered done; a red suite is never carried into the next slice.
- **Security/data considerations:** tests never use production credentials; the payment provider is always in test mode outside production.
- **Verification:** `pytest -x` and `pytest --cov` locally; the same gates in CI.
- **Dependencies:** T-004, T-005, T-007, T-008, T-009.
- **Risks:** RK-018 — the pre-launch runbook's manual scenarios are the only coverage for cross-surface journeys until Wave 9.

### T-019 — Observability and operations

- **Purpose:** make failures visible to one operator without dashboards nobody reads.
- **Realizes:** F-023, F-024.
- **Design:** Sentry release-tagged across four surfaces, structured JSON logs, `/healthz` for app and database and `/readyz` for the dependency set, a daily reconciliation alert to Sentry and Ops email, and a weekly founder digest covering GMV, fees, hires by state and third-party usage.
- **Interfaces/contracts:** runbooks live in `docs/runbooks/` — payout batch, refund handling, dispute resolution, key rotation, tile-provider switch and host response.
- **Invariants and failure handling:** every periodic job is idempotent, so a missed cron run self-heals rather than needing manual repair.
- **Security/data considerations:** logs carry no secret values and no full bank numbers.
- **Verification:** the reconciliation alert fires on an injected mismatch; the digest sends on schedule.
- **Dependencies:** T-001, T-008, T-009.
- **Risks:** RK-019 — with one operator, an alert that is not actionable within a day is equivalent to no alert.

## Traceability

Every functional requirement maps to at least one technical requirement, and every
technical requirement realizes at least one functional requirement.

| Functional | Realized by |
|---|---|
| F-001 | T-005, T-004 |
| F-002 | T-009, T-006, T-008 |
| F-003 | T-005, T-006, T-019 |
| F-004 | T-011, T-006 |
| F-005 | T-002, T-006, T-017 |
| F-006 | T-012, T-017, T-006 |
| F-007 | T-006, T-010 |
| F-008 | T-006, T-011, T-012 |
| F-009 | T-006, T-011 |
| F-010 | T-010, T-011 |
| F-011 | T-010, T-016 |
| F-012 | T-010, T-011 |
| F-013 | T-007, T-008 |
| F-014 | T-007, T-006 |
| F-015 | T-008, T-011 |
| F-016 | T-008, T-006, T-004 |
| F-017 | T-012, T-008, T-016 |
| F-018 | T-009, T-008, T-005 |
| F-019 | T-013, T-014, T-006 |
| F-020 | T-014, T-008, T-011 |
| F-021 | T-016, T-011 |
| F-022 | T-015, T-011 |
| F-023 | T-019, T-017, T-011 |
| F-024 | T-001, T-002, T-003, T-017, T-018, T-019 |
| F-025 | T-018, T-019, T-003 |

## Cost evidence

The budget guardrail is **≤ $25/month total infrastructure** (D-012, still binding after
D-027 moved hosting). Adding a paid service or tier requires owner approval.

| Item | Basis | Monthly |
|---|---|---|
| Compute, database and portal hosting | Self-hosted VPS under Docker Compose (D-027); the host is pre-existing sunk cost, and the superseded Railway plan it replaced was ~$10–15 | $0 incremental |
| Realtime | Ably free tier — 200 concurrent connections, 6M messages; alert at 70% through the weekly digest | $0 |
| Object storage | Cloudflare R2, public and private buckets at MVP volume | within free allowance |
| Maps and geocoding | OpenFreeMap tiles plus LocationIQ free tier through the server-side proxy (D-013, chosen on terms of service rather than price) | $0 |
| Payments | Paystack per-transaction only, no monthly fee; collection 1.5% + ₦100 capped ₦2,000 (D-018) | usage-based |
| SMS and email | Termii per-message, Resend free tier | usage-based |
| Error tracking | Sentry free tier across four surfaces | $0 |

Total fixed cost fell after D-027 — Railway and Cloudflare Workers were decommissioned
and the VPS is sunk cost — so the ceiling holds with headroom.

## Blocking open decisions

No blocking O-IDs remain. The open items in [DECISIONS.md](../DECISIONS.md) are product
and operational follow-ups, not gaps in this technical specification. The two closest to
this document are recorded as risks rather than unknowns: the `spec_templates` version
hazard behind a future certification field (RK-006) and the still-unset production keys
(RK-002), both of which have a known shape and a known fix.

## Verification register

| Requirement | Method | Evidence | Status |
|---|---|---|---|
| T-001 | Deploy then health-check | `infra/vps/deploy.sh`; `/healthz` and `/readyz` | green |
| T-002 | Settings import per environment; `.env.example` completeness in CI | `backend/settings/`; `.github/workflows/backend.yml` | green |
| T-003 | CI run on pull request | `.github/workflows/` | green |
| T-004 | Services unit-tested without HTTP | `backend/*/services.py` suites | green |
| T-005 | FSD §3.1 vectors plus property tests | `backend/hires/fees.py` suite | green |
| T-006 | Reversible migration up and down; append-only assertion | `backend/*/migrations/` | green |
| T-007 | Threaded double-payment on the last unit | `backend/hires/` race test | green |
| T-008 | Every legal and illegal transition; double-run sweeps | `backend/hires/state.py` suite | green |
| T-009 | Duplicate, out-of-order and replayed webhooks; five test-mode hires | `backend/payments/` suite | green |
| T-010 | Solo, yard, filtered and zero-match cases; P95 measured | `backend/search/` suite | green |
| T-011 | Schema regeneration diff; D-014 shaping test | `backend/openapi/schema.yml` | green |
| T-012 | Private object unreachable without a presigned URL; idempotent purge | `backend/core/media.py` suite | green |
| T-013 | Masking on and off conditions | `backend/messaging/` suite | green |
| T-014 | Degradation to polling without loss; token scoping | `backend/core/realtime.py` suite | green |
| T-015 | BFF refresh unit tests; login → create listing → accept hire smoke | `portal/` vitest and Playwright | green |
| T-016 | Price-preview and countdown hook tests; device journeys | `mobile/` suite | in progress |
| T-017 | Purge honours every carve-out; admin requires a second factor | `backend/accounts/` and `backend/ops/` suites | green |
| T-018 | Coverage gates hold | `pytest --cov` | green |
| T-019 | Injected mismatch raises the reconciliation alert | `backend/payments/` reconciliation suite | green |

## 1. System Topology

> **Superseded in part by D-027.** The diagram below documents the original Railway +
> Cloudflare Workers topology and is retained for history. Production now runs api,
> worker, PostGIS and the portal as one Docker Compose project on the founder's VPS,
> bound to loopback behind the host nginx ingress — see **T-001** above and `DEPLOY.md`.
> Everything else in this section still holds: R2 buckets, Ably fan-out, Sentry on four
> surfaces, and **no Redis anywhere** (D-010).

```
 Hirer app (Expo RN)        Supplier Portal (Next.js @ CF Workers)
        │  HTTPS/JSON              │  (BFF route handlers, httpOnly cookies)
        ▼                          ▼
 ┌──────────────────────────────────────────────┐
 │ Railway: api    (Django + gunicorn, 512MB)   │ ←─ Paystack webhooks
 │ Railway: worker (django-tasks runner, 256MB) │ ─→ Termii / Resend / Ably REST / Paystack API
 │ Railway: PostgreSQL 17 + PostGIS 3.5         │
 └──────────────────────────────────────────────┘
   Cloudflare R2: public bucket (listing/storefront media)
                  private bucket (verification docs, handover photos)
   Ably: realtime fan-out (clients subscribe via server-issued tokens)
   Sentry: api · worker · portal · app
```
One region (Railway EU-west); Nigeria RTT ~120–180ms — acceptable at MVP. **No Redis anywhere** (D-010). The DB is the broker, the queue, and the source of truth.

## 2. Repository, Environments, CI/CD

### 2.1 Monorepo layout
```
terminal/
├── design.md                  # coding-agent engineering guide (root)
├── docs/                      # all v2 planning + this TSD/FSD (+ PDFs)
├── backend/
│   ├── manage.py
│   ├── pyproject.toml         # deps via uv/pip-tools; ruff config
│   ├── settings/  base.py dev.py prod.py test.py
│   ├── core/      accounts/  suppliers/  listings/  search/
│   ├── hires/     payments/  messaging/  ops/
│   └── tests/                 # cross-app integration tests
├── portal/                    # Next.js 15 App Router (@opennextjs/cloudflare)
│   └── src/app  src/components  src/lib(bff, api-client)  wrangler.toml
├── mobile/                    # Expo RN, TypeScript, expo-router
│   └── app/  components/  lib/  assets/
├── packages/tokens/           # design tokens JSON → tailwind.tokens.js, tokens.ts, glyphs/
├── docker-compose.yml         # postgis:17-3.5 + mailpit (dev)
└── .github/workflows/         # backend.yml portal.yml (path-filtered)
```

### 2.2 Environments & config
- **dev:** docker-compose (PostGIS + mailpit); Paystack/Termii/Ably test keys; `DEBUG=1`. **prod:** Railway + Workers. **No staging in MVP** — Paystack test mode + feature flags bridge; staging returns in Phase 2.
- django-environ; `.env.example` exhaustive and CI-checked. Key vars:

| Var | Notes |
|---|---|
| `DATABASE_URL` | postgis:// scheme |
| `SECRET_KEY`, `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS` | prod from Railway env |
| `FIELD_ENCRYPTION_KEY` | Fernet key for bank numbers |
| `R2_ACCOUNT_ID/ACCESS_KEY_ID/SECRET/PUBLIC_BUCKET/PRIVATE_BUCKET/PUBLIC_BASE_URL` | |
| `PAYSTACK_SECRET_KEY/PUBLIC_KEY/WEBHOOK_SECRET` | webhook secret = account secret (HMAC) |
| `ABLY_API_KEY` · `TERMII_API_KEY/SENDER_ID` · `RESEND_API_KEY` · `LOCATIONIQ_KEY` | absent in dev ⇒ console/log fallback, never crash |
| `SENTRY_DSN/ENVIRONMENT` | |

### 2.3 CI/CD
- Backend PR gate: ruff (lint+format) + mypy (loose) + pytest against PostGIS service container; coverage gates 85% `hires`+`payments`, 70% overall.
- Portal PR gate: eslint + tsc + build. App: tsc + jest unit (no CI device builds).
- Deploy (**amended by D-027**): ~~merge to `main` → Railway auto-deploy · portal via wrangler GH action~~. **Merging to `main` ships nothing.** Production updates only when `infra/vps/deploy.sh` is run manually on the VPS against `/opt/terminal/repo` (fetch+reset to `origin/main`, build, migrate, roll, health-check). Mobile: local Android / EAS-free iOS, manual cadence; OTA via expo-updates for JS-only changes.

## 3. Backend Design

### 3.1 Apps & ownership
| App | Owns |
|---|---|
| `core` | BaseModel (UUIDv7 PK, created/updated), permissions (IsSupplier, IsHirer, IsVerified), pagination, error envelope, `core.money`, healthz/readyz, R2 presign service |
| `accounts` | User (custom, migration 0001), OTP, JWT, password reset, VerificationRequest |
| `suppliers` | SupplierProfile, Yard, storefront read API, strikes |
| `listings` | Listing, Unit, SpecTemplate (+ validation), photos, Report, duplicate action |
| `search` | Map + list search, yard aggregation |
| `hires` | Hire, HireEvent, HandoverRecord, AvailabilityBlock (D-024); state machine `hires/state.py`; fees `hires/fees.py`; availability `hires/availability.py` |
| `payments` | Payment, Refund, Payout, PaystackEvent; client, webhook, reconciliation |
| `messaging` | Conversation, Message, masking, Ably token endpoint, unread counters |
| `ops` | Admin site, queues, dashboard, dispute actions, weekly digest |

**Service-layer rule (binding):** views/serializers never mutate domain state. All writes flow through `services.py` functions taking `(actor, …)` and returning domain results. The state machine, fee engine, and availability check are pure, importable, and unit-tested in isolation. Signals are not used for business logic (only for cache-ish denorm if ever needed); side-effects dispatch via `transaction.on_commit(lambda: task.enqueue(...))`.

### 3.2 Money (`core.money`)
- All amounts are **integer kobo** (`BigIntegerField`) — Paystack-native, no Decimal drift. Helpers: `kobo(naira)`, `naira(kobo)`, `display(kobo) → "₦1,250,000"`. Kobo never shown in UI (whole-naira product).
- **Fee engine** (`hires/fees.py`, pure):
```python
RATE_TABLE = {  # D-002; per mille to stay integer  (‰)
  "plant_machinery":   {"daily": 120, "weekly": 100, "monthly": 80},
  "trucks_haulage":    {"daily": 110, "weekly": 90,  "monthly": 70},
  "warehousing":       {"daily": 100, "weekly": 80,  "monthly": 60},
  "terminals_yards":   {"daily": 100, "weekly": 80,  "monthly": 60},
  "land_staging":      {"daily": 100, "weekly": 80,  "monthly": 60},
}
FEE_FLOOR = 250_000  # kobo = ₦2,500

def price_hire(listing, days) -> Price:
    candidates = {}                                  # only schemes with a rate set
    if listing.daily_price:   candidates["daily"]   = listing.daily_price * days
    if listing.weekly_price:  candidates["weekly"]  = listing.weekly_price * ceil(days/7)
    if listing.monthly_price: candidates["monthly"] = listing.monthly_price * ceil(days/30)
    scheme = min(candidates, key=lambda s: (candidates[s], -SCHEME_LENGTH[s]))   # D-008, tie→longer
    hire_value = candidates[scheme]
    rate = RATE_TABLE[listing.asset_class][scheme]
    service_fee = max(hire_value * rate // 1000, FEE_FLOOR)
    return Price(scheme, hire_value, service_fee, hire_value - service_fee,
                 fee_basis=f"{rate/10:.0f}% {scheme} (min ₦2,500)")
```
FSD §3.1 worked examples are the canonical test vectors; add hypothesis property tests (monotonicity, floor, payout+fee≡value).

### 3.3 Schema (normative; all tables UUID PK + timestamps unless noted)

**users** — full_name · email citext uniq · phone uniq (E.164) · password (bcrypt 12) · is_supplier, is_hirer · account_level enum(basic, verified, business_verified) · is_active · phone_verified_at · email_verified_at (phone & email verified independently; Basic requires both) · tos_accepted_at, privacy_accepted_at (NDPR consent) · token_version (session-invalidation lever, carried as the JWT `tv` claim) · suspended_at/reason · deleted_at (soft) · purged_at (set by the daily purge after PII scrub).
**otp_codes** — user FK · code_hash (HMAC-SHA256, no plaintext at rest) · purpose enum(phone_verify, email_verify) · expires_at · attempts · consumed_at. (Rate limits enforced in service.)
**password_reset_tokens** — user FK · token_hash · expires_at (1h) · used_at (single-use).
**supplier_profiles** — user 1:1 · business_name/description/logo_key · bank_name · `bank_account_number_enc` (Fernet) · bank_account_name · notif prefs (4 × bool) · strike_count.
**yards** — supplier FK · name · `point geography(Point,4326)` GIST · address_text · city.
**spec_templates** — asset_class · asset_type · version · `fields jsonb` (defs per doc 05) · uniq(class, type, version). Seeded by data migration from `docs/v2/05`.
**listings** — supplier FK · yard FK null (ON DELETE PROTECT) · asset_class enum · asset_type · title ≤120 · description · `specs jsonb` · spec_template_version · daily/weekly/monthly_price kobo (weekly/monthly null) · unit_count ≥1 · `point` (denorm from yard) GIST · address_text · city · status enum(draft, live, paused, archived, removed) · tier enum(basic, verified, inspected) · report_count · completeness_score · removed_reason. Indexes: (status, asset_class) · (supplier, status) · GIN on specs (jsonb_path_ops) for ★ filters.
**listing_photos** — listing FK · r2_key · position · is_cover. ≤10 enforced in service.
**units** — listing FK · label (only when supplier labels units).
**hires** — listing FK PROTECT · hirer FK · supplier FK (denorm) · yard FK null (denorm) · start_date, end_date, duration_days · scheme · fee_basis · hire_value, service_fee, payout_amount (kobo, **locked at acceptance**) · status enum(requested, accepted, confirmed, on_hire, completed, declined, expired, cancelled, in_dispute) · cancelled_by enum(hirer, supplier, ops, system) null · decline_reason/cancel_reason · hirer_note · `request_expires_at` · `payment_deadline` null · acknowledgments jsonb · parent_hire null. Indexes: **(listing, status, start_date, end_date)** (availability hot path) · (hirer, status) · (supplier, status) · partial on holding states.
**hire_events** — hire FK · actor_kind(user/system/ops) + actor FK null · from_status, to_status · meta jsonb · created_at. **Append-only** (DB: revoke UPDATE/DELETE from app role; admin readonly).
**handover_records** — hire FK · kind(on_hire, off_hire) uniq with hire · photos jsonb (private R2 keys) · reading numeric null + reading_kind · notes · supplier_confirmed_at, hirer_confirmed_at.
**payments** — hire FK · paystack_reference uniq · authorization_url · amount kobo · state(initiated, success, failed, abandoned) · paid_at · channel.
**paystack_events** — event_id uniq (webhook dedup) · payload jsonb · processed_at.
**refunds** — hire FK · amount · state(pending, completed, failed) · paystack_ref · reason.
**payouts** — hire FK uniq · supplier FK · amount · state(pending, due, paid, frozen) · paid_ref · paid_at · frozen_reason.
**conversations** — kind(enquiry, hire) · listing FK null · hire FK null uniq · supplier FK, hirer FK · partial uniq (listing, hirer) where kind=enquiry and listing not null.
**messages** — conversation FK · sender FK · body · body_masked null · sent_at · read_at null. Serving rule: `body_masked or body` until conversation unmask condition (hire paid); enquiry conversations always masked.
**verification_requests** — user FK · kind(identity, business) · doc_keys jsonb (private bucket) · state(pending, approved, rejected) · reviewer FK null · reason · rc_number (business) · decided_at. One pending request per (user, kind) (partial-unique).
**reports** — listing FK · reporter FK · reason enum · state(open, dismissed, warned, removed) · resolution note.

### 3.4 Availability & the concurrency contract
Holding states: `confirmed`, `on_hire`, and `accepted` with `payment_deadline > now()`.
```sql
SELECT count(*) FROM hires
 WHERE listing_id = :listing AND status IN ('accepted','confirmed','on_hire')
   AND (status <> 'accepted' OR payment_deadline > now())
   AND start_date <= :end AND end_date >= :start;
-- range available iff count < listing.unit_count
```
**Supplier date-blocks (D-024):** an `AvailabilityBlock (listing, start_date, end_date, reason, created_by)` overlapping the range is a **hard hold on the whole listing** — `is_available`, `free_units`, and `can_confirm` all return zero/false when a block overlaps, so accept/pay reject through the same row-lock re-check (no new state-machine edges). Folded into the bulk `availability_map` (search) and the per-day `free_units_by_day` (the public calendar) with one extra indexed query each. Read-only endpoint `GET /listings/{id}/availability?from=&to=` returns per-day free-unit counts (counts only, ≤90-day window); `/search/map` + `/search/list` accept optional `date_from`/`date_to` so the `available` flag reflects a chosen window.
**Race rule (binding):** `accept_hire` and `apply_payment_success` execute in a transaction that first takes `SELECT … FOR UPDATE` **on the listing row**, then re-checks availability, then writes. Two concurrent payments on the last unit cannot both pass; the loser's payment triggers automatic refund (full) + apology notification — this path must be tested. On entering `confirmed`, the same transaction auto-declines overflowed requested/accepted hires and queues their notifications on commit.

### 3.5 State machine & timers
- `hires/state.py`: `TRANSITIONS: {(from_status, action): to_status}` + per-transition guards (actor role, payment state, acknowledgment presence). `apply(actor, hire, action, **meta)`: validate → lock (listing FOR UPDATE where capacity-relevant) → write → append HireEvent → on-commit side-effects (email, Ably, badge counters).
- **Sweeps (django-tasks, every 5 min, idempotent):** requested past `request_expires_at` → expired · accepted past `payment_deadline` → cancelled(system, payment_expired) · confirmed past start+24h → on_hire · on_hire past end+48h undisputed → completed (+ payout `due`).
- **Daily:** Paystack reconciliation (transactions list vs payments; mismatch → Sentry + Ops email). **Weekly:** founder metrics digest; R2 orphan sweep.
- django-tasks worker runs as the Railway `worker` service; scheduled invocation via worker-side scheduler; every task idempotent (re-running a sweep is a no-op).

### 3.6 Paystack integration (D-006)
- **Initialize** (on accept): `POST /transaction/initialize` — amount=hire_value (kobo), `channels=["card","bank_transfer","ussd"]`, `metadata={hire_id}`, `reference=f"THR-{hire.short_id}-{attempt}"`. Store reference + authorization_url.
- **Webhook** `POST /api/v1/payments/webhook/`: verify `x-paystack-signature` = HMAC-SHA512(raw body, secret); insert `event_id` (duplicate ⇒ 200 skip); enqueue handler; return 200 fast. Handler calls `GET /transaction/verify/:reference` (belt-and-braces) before `state.apply(system, hire, "pay")`.
- Client redirects are **never** trusted; the app polls hire status after browser return.
- **Refunds:** `POST /refund` with computed amount (FSD §7.6); processor fee non-recoverable (≈₦2,000 cap) — absorbed per cancellation rules.
- Paystack **Starter** business at launch (manual payouts need no Transfers); CAC registration in motion for Phase 2 rails. Collection fee: 1.5%+₦100 capped ₦2,000 (waived <₦2,500) — local channels only; international cards rejected in MVP (3.9% uncapped breaks fee math).

### 3.7 Search & map aggregation
`GET /api/v1/search/map` params: `bbox` or (`lat,lng,radius_km`) · `asset_class` · `q` · `price_min/max` · `spec_min/max` (★ field per class) →
```json
{ "yards": [ { "yard_id", "name", "point", "supplier": {"id","name","logo","badge"},
              "listing_count", "matching_count", "class_mix": ["plant_machinery","trucks_haulage"],
              "price_from", "listings": [ {"id","title","asset_class","price_from","photo","available"} ] } ],
  "listings": [ {"id","title","asset_class","point","price_from","distance_km","photo","badge"} ] }
```
- Yards aggregate **server-side** (GROUP BY yard over Live listings) — authoritative counts (Fleet A2/A4); summaries ride along so the Yard Sheet opens with zero extra round-trips (E4). `listings[]` carries solo pins only.
- Distance: `ST_Distance(point, ref::geography)/1000` rounded 0.1km; order by distance. Viewport: `point && ST_MakeEnvelope(...)` + GIST. ★ spec filters via JSONB containment/range on GIN.
- Client-side concerns: MapLibre clustering of *returned* pins (spatial), pin styling per doc 08 §4.2.

### 3.8 API conventions & inventory
- Base `/api/v1/`; OpenAPI at `/api/docs/` (drf-spectacular) — **each module's schema is published before its frontend wave starts; the schema is the cross-team handshake.**
- Auth: `Authorization: Bearer <access>`; simplejwt rotating refresh + blacklist. Errors: `{"error":{"code","message","fields?"}}` with stable `code` strings (e.g. `availability_conflict`, `payment_window_expired`, `verification_required`, `basic_cap_exceeded`). Cursor pagination on lists. Throttles: anon search 60/min · auth 120/min · OTP send 3/h/phone · login 5/15min/IP · report 5/day/user.

> **Wave 1 build notes (accounts, shipped):** the `login 5/15min/IP` limit is realised as two complementary mechanisms — a coarse `login` request-throttle (5/min) plus a cache-based **failure** lockout (5 failures / 15 min / IP). Session invalidation on logout-all / password-reset-confirm uses a `token_version` (`tv`) claim checked in a custom `JWTAuthentication`, so access tokens die immediately (blacklist alone only kills refresh). Phone and email are verified **independently**, each over its own channel: a phone OTP is delivered **only by SMS** (Termii) and an email OTP **only by email** (Resend) — codes are never crossed, so an email can't prove phone ownership. Both `otp_codes` are HMAC-hashed. Login (Basic) requires **both** `phone_verified` and `email_verified` (FSD §4.1); the gates raise `phone_not_verified` / `email_not_verified`. Phone delivery is **loud, not silent**: if SMS can't be sent (provider error, or no `TERMII_API_KEY` in prod) it raises `otp_delivery_failed` rather than substituting another channel — in dev (`DEBUG`) the code prints to console. Endpoints: `auth/otp/{verify,resend}` (phone, keyed/throttled per phone), `auth/email/{verify,resend}` (email, keyed/throttled per email). `me/verification` accepts **direct multipart** uploads (the generic `media/presign` flow is deferred to Wave 2); private docs are served via 15-min presigned GETs (R2) or an Ops-only signed stream view (local dev). The lockout cache is per-process in dev — prod multi-worker needs a shared cache (DB-cache, no Redis) before launch. Password hashing is bcrypt (`bcrypt` runtime dep); other new deps: `boto3` (R2), `httpx` (Termii/Resend).

| Area | Endpoints |
|---|---|
| auth | `POST register` · `POST otp/verify` · `POST otp/resend` (phone) · `POST email/verify` · `POST email/resend` · `POST login` · `POST token/refresh` · `POST logout` · `POST password-reset` · `POST password-reset/confirm` |
| me | `GET/PATCH me` · `DELETE me` (soft-delete, 30-day recovery; blocked by `active_hire_guard`) · `POST me/activate-supplier` · `POST me/verification` (docs to private bucket) · `GET me/verification` |
| suppliers | `GET/PATCH suppliers/me/profile` · `GET/POST yards` · `PATCH/DELETE yards/:id` · `GET storefronts/:supplier_id` (public) |
| listings | `GET/POST listings` (mine) · `GET listings/:id` (public if Live) · `PATCH listings/:id` · `POST :id/publish|pause|archive|duplicate` · `POST :id/photos` (presign+attach) · `PATCH :id/photos/order` · `DELETE :id/photos/:photo_id` (cover promotion + reindex; additive, 2026-07-06) · `POST :id/reports` · `GET spec-templates?class=&type=` |
| search | `GET search/map` · `GET search/list` (same params + cursor + group_by=asset\|location) |
| hires | `POST hires` (listing, dates, note) · `GET hires?role=&status=` · `GET hires/:id` (+`events[]`, role-shaped financials per D-014) · `POST :id/accept|decline|cancel` · `GET :id/payment` (status+authorization_url) · `POST :id/handovers` · `POST handovers/:id/confirm` |
| payments | `POST payments/webhook` (Paystack only, signature-gated) |
| messaging | `GET conversations` · `POST conversations` (enquiry: listing_id or supplier_id) · `GET conversations/:id/messages` · `POST conversations/:id/messages` · `POST messages/read` · `GET realtime/token` (Ably token request, capability-scoped) |
| misc | `POST media/presign` (kind-scoped: listing_photo/avatar/logo/verification_doc/handover_photo; content-type+size validated) · `GET healthz` · `GET readyz` · `GET geocode?q=` (LocationIQ proxy, server-side key, cached 24h) |

**Serialization rule (D-014):** the Hire serializer is **role-shaped** — `service_fee` and `payout_amount` fields are present only when `request.user == hire.supplier` or staff. This is enforced in the serializer layer with tests, not left to clients.

### 3.9 Media pipeline
Client → `POST media/presign` (validates kind, content-type, ≤ size cap; returns key + presigned PUT) → direct R2 upload → attach key via the owning endpoint. Public bucket via R2 public domain (listing photos ≤10MB accepted but clients pre-resize to ≤1920px/~1MB via Expo ImageManipulator / portal canvas). Private bucket (verification docs, handover photos — D-025): presigned GET, 15-min expiry, parties+Ops only; handover reads are minted as `photo_urls` on the handover serializer (participants-only access is enforced where the URL is issued). Weekly orphan sweep deletes unattached keys >7 days old. **Handover-photo retention (D-026):** photo objects are purged 90 days after the off-hire handover is confirmed (idempotent daily `purge_handover_photos` sweep, marker `HandoverRecord.photos_purged_at`); the record rows are retained indefinitely.

### 3.10 Masking implementation
On message create: regex Nigerian phones (`(\+?234|0)[789][01]\d{8}` + spaced/dotted variants) + emails → `body_masked` stored alongside `body`. Serving: hire conversations serve `body` once the hire is paid, else `body_masked`; enquiry conversations always serve `body_masked`. Original `body` retained (Ops/dispute visibility). Masking notice is a UI concern (MaskedContact component, doc 08 §3.4).

## 4. Realtime (Ably, D-011)
- `GET /api/v1/realtime/token` → Ably TokenRequest, capabilities limited to the caller's channels.
- Channels: `conv:{conversation_id}` (new messages) · `user:{user_id}` (badge counts, hire status changes). Server publishes via Ably REST inside `transaction.on_commit`.
- Postgres rows are the message of record; Ably is fan-out only. Client degradation: 15s polling when Ably is unavailable (FSD §8). Free-tier budget: 200 concurrent / 6M msgs — alert at 70% via Ably stats in the weekly digest.

## 5. Supplier Portal
- Next.js 15 App Router, **containerised on the VPS** (D-027; ~~`@opennextjs/cloudflare` on Workers, D-012~~); Tailwind + **bespoke token-driven components** (D-019, refined by D-020's headless allowlist; ~~shadcn/ui~~) themed from `packages/tokens`, **dark-only** per D-028; TanStack Query; react-hook-form + zod (mirrors DRF validation); `maplibre-gl` for yard/listing pins; Ably JS for live inbox.
- **BFF auth:** `/auth/*` route handlers proxy DRF; access+refresh JWTs in `httpOnly Secure SameSite=Lax` cookies; auto-refresh on 401 (single-flight); browser JS never sees tokens; all data calls via `/bff/*` adding Bearer.
- Routes per FSD §10.2. CalendarGantt = custom CSS grid (no heavyweight calendar dependency). DataTable, Stepper, LockedTerms, EventTimeline, StatusBadge per design-system chapters 05–06.

## 6. Hirer App
- Expo SDK (current) · TypeScript strict · expo-router · TanStack Query + Zustand (session, map filters) · tokens in SecureStore · NativeWind styled from `packages/tokens`.
- Map: `maplibre-react-native` + OpenFreeMap style URL (Protomaps-on-R2 fallback = config swap, D-013); pins/Yard Sheet per doc 08 §4.2; LocationIQ autocomplete via backend proxy.
- Payments: open `authorization_url` in `expo-web-browser`; on return **poll hire status** (webhook is truth). CountdownPill drives urgency.
- Handover: camera-first capture, client resize, presigned PUT. Offline posture: tile cache + persisted Query cache (MMKV) so My Hires/Messages render cold; mutations require connectivity — except handover capture, the one allowed offline mutation (D-016): photos queue locally, the record submits on reconnect (per ux/02 S11).
- Distribution: local Android builds; EAS free tier iOS (15/mo) + expo-updates OTA for JS changes.

## 7. Security & Compliance Implementation
HTTPS/HSTS platform-level · bcrypt 12 · Fernet bank-number encryption (key rotation procedure documented in runbook) · private R2 presigned GET 15-min · Paystack HMAC + `paystack_events` dedup · CORS allowlist (portal origin; app uses native fetch) · throttles §3.8 · Django Admin: staff-only, django-otp 2FA, separate cookie path, IP logging · audit = append-only `hire_events` + LogEntry retention · NDPR: registration consent copy, soft-delete + 30-day purge task with retention carve-outs (financial 7y, verification 5y) · secrets only in platform env · dependency updates: Dependabot weekly, security patches within 72h.

## 8. Testing Strategy
- **Backend:** pytest + factory-boy + freezegun + hypothesis. Mandatory suites: fee engine (FSD §3.1 vectors + property tests) · availability incl. **FOR UPDATE race test** (threaded double-payment on last unit) · state machine (every legal + illegal transition, guard failures) · webhook idempotency (duplicate event_id, out-of-order, replay) · sweep idempotency (double-run) · refund math per §7.6 row · D-014 serializer shaping (hirer never receives fee fields) · masking on/off conditions. Coverage gates: 85% `hires`+`payments`, 70% overall.
- **Portal:** vitest (BFF refresh logic, fee display logic) + 1 Playwright smoke (login → create listing → accept hire) against compose.
- **App:** TS strict; unit tests for price-preview + countdown hooks; manual E2E per release checklist (Detox deferred).
- **Pre-launch runbook:** the FSD §11.4 failure scenarios + 5 end-to-end Paystack-test-mode hires, documented and repeatable.

## 9. Observability & Operations
Sentry (4 surfaces, release-tagged) · structlog JSON → Railway logs · `/healthz` (app+DB) `/readyz` (DB, R2, Ably auth, Paystack ping) · reconciliation alert → Sentry + Ops email · weekly digest (GMV, fees, hires by state, Ably usage, R2 usage) → founder email · runbooks in `docs/runbooks/`: payout batch, refund handling, dispute resolution, key rotation, OpenFreeMap→Protomaps switch, Railway usage-cap response.

## 10. Build Waves (gated — founder approval required to start each wave)

**This section is a pointer, not a schedule.** Delivery sequencing has exactly one
authority: **[docs/waves/README.md](waves/README.md)**, which holds the wave index, each
wave's deliverable and exit criterion, and its current approval status. Each wave's full
build brief is its own file in `docs/waves/`.

The rules that bind this document remain: **no wave starts without explicit founder
approval**, and contracts frozen at a wave's end are breaking-change-locked — changing one
requires founder sign-off (T-011). Waves 7–8 may interleave with 5–6 now that Wave 4's
OpenAPI contracts are frozen.

The wave table that used to be duplicated here was removed under D-031, because a second
copy of a mutable status table drifts from the first.

## 11. Out-of-Scope Architecture Notes (Phase 2+ hooks already accommodated)
Paystack Transfers/split (payout model already shaped) · deposits (PB §7 tiers; card-hold flow) · `parent_hire` extensions · NIN/BVN/CAC API verification (VerificationRequest.kind extensible) · push (Expo notifications; device-token table added then) · reviews (post-completion hook on the state machine) · rate-config UI (RATE_TABLE → DB table) · multi-region/multi-currency (money stays integer minor-units).

— End of TSD v2.1 —
