<!-- vps-governance-stub -->
## VPS agent entry point

Canonical VPS-wide policy: `/root/projects/_governance/` (git repo — commit policy changes).
Core rules load automatically in Claude Code and Cursor; this stub only points home.

Before non-trivial work in this repo:

```bash
/root/projects/_governance/vps-preflight.sh
```

- Secrets: never hardcode, never print values. See `_governance/secrets-policy.md`.
  Infisical is already running and linked — run `_governance/infisical-check.sh`, never reinstall.
- Host facts (ports, containers, gotchas): `_governance/vps-vital-facts.md`

This repository may add **stricter** requirements below, but may not weaken the VPS baseline.
<!-- /vps-governance-stub -->

# Terminal — Agent Guide

This is the platform-neutral cold-start map for every agent and tool working in this
repository. `CLAUDE.md` and `.cursor/rules/governance.mdc` are thin pointers to this file.

Terminal is a map-first B2B marketplace for hiring heavy assets in Nigeria (Plant &
Machinery, Trucks & Haulage, Warehousing, Terminals & Container Yards, Land & Staging).
Suppliers list assets at Yards; Hirers discover them on the Map and pay through Terminal
(Paystack, collect-only). The product is the **transaction record**.

## Start every session

1. **Read [Implementations.md](Implementations.md)** — the append-only progress log. Its
   newest entries are the fast truth of what was just done, deployed, or left blocked.
2. **Read [design.md](design.md)** — the engineering guide. It overrides anything
   summarized here. Then read the document-authority docs below for your task area.
3. **Read [docs/waves/README.md](docs/waves/README.md)** — the sole wave-status authority.
   Work only inside a wave whose approval is recorded there as in progress.
4. **Read the active wave brief** in `docs/waves/` and the operational gotchas in
   `Implementations.md`.
5. **Determine wave status from code, not just docs.** Check which backend apps have
   models and migrations, which `/api/v1/` routes exist, and which tests run. If
   `docs/waves/README.md` disagrees with the code, **trust the code** — then reconcile
   the docs.
6. **Confirm the next wave is founder-approved before building it.** Wave gating is
   binding (design.md §7). Finishing one wave never authorizes the next.
7. Run the checks relevant to the slice you are touching (see Commands).

Governance runtime state (canonical worktree, reconciliation, stage closure) is managed by
`governancectl`; `.governance/config.json` records that this repository is governed.

## Document authority (where truth lives)

Each concern has exactly **one** authority. Where two documents disagree, the one named
here wins and the other is a defect to fix — never a judgement call to make in code.

| Document | Authoritative for |
|---|---|
| [DECISIONS.md](DECISIONS.md) | Ratified founder decisions D-001…D-031, plus observations and open items. **Binding — never re-litigate in code.** |
| [docs/perblis-terminal-FSD.md](docs/perblis-terminal-FSD.md) | WHAT the system does — behaviour, actors, states, rules, acceptance |
| [docs/perblis-terminal-TSD.md](docs/perblis-terminal-TSD.md) | HOW — architecture, schema, services, API contract shape |
| [design.md](design.md) | Engineering invariants, fixed stack, conventions, Definition of Done |
| [docs/waves/README.md](docs/waves/README.md) | Wave status and approval evidence — **the only place status is tracked** |
| `docs/waves/wave-N.md` | Scope, tests, contracts, slices and exit criterion for that wave |
| [Implementations.md](Implementations.md) | Shipped reality, operational gotchas, handoff notes |
| `docs/v2/02_System_Lexicon.md` | Every approved name (UI, API, DB) |
| `docs/v2/05_Asset_Spec_Schemas.md` | Spec templates per asset class (seed data source) |
| `docs/v2/08_Design_System.md` + `docs/v2/design-system/` | Visual/UX language; chapters win over the summary |
| `docs/v2/ux/` | Journeys, flows, screen-by-screen specs |
| `docs/legacy-v1/`, Policy Bible, FSD v1 | Historical input only — **the canonical FSD wins all conflicts** |

Code, tests, Git and CI are evidence of current reality. They do not silently override
ratified intent — a conflict between them is surfaced as a decision, not resolved in a
commit.

**Section numbers are stable.** `FSD §7.6` and `TSD §3.4` resolve inside the canonical
files exactly as they always have; the `F-###` / `T-###` requirement layers were added
above them for traceability and amend nothing (D-031). `docs/v2/06_FSD_v2.md`,
`docs/v2/07_TSD.md` and `docs/v2/DECISIONS.md` are pointers to the canonical files. PDF
mirrors live in `docs/v2/pdf/`; `scripts/md2pdf.py` regenerates them.

## Repository state — snapshot, not authority

**Snapshot taken 2026-08-17. It can lag. `docs/waves/README.md` is the authority for wave
status, and `Implementations.md` for what shipped.** This section exists so a cold agent
knows roughly where it has landed, not so it can skip step 3 above.

Waves 0–6 are complete, merged and founder-signed-off, and the backend is deployed on the
VPS. Wave 7 (Supplier Portal) is built and merged but awaiting sign-off. Wave 8 (Hirer
app) is in progress. Wave 9 is gated.

- `backend/core` — BaseModel (UUIDv7), `money`, permissions, cursor pagination, error
  envelope, `/healthz` + `/readyz`, heartbeat task, `manage.py deploy` (advisory-locked
  migrate + seed), `media` presign pipeline, `realtime.py`.
- `backend/accounts` — register, **independent phone (SMS) + email OTP** (both required
  for login), JWT login/refresh/logout (rotating + blacklist + `tv` session-invalidation
  claim), no-enumeration password reset, `GET/PATCH/DELETE me`, supplier activation,
  identity/business verification docs (private R2 + Ops review queue), soft-delete + NDPR
  purge.
- `backend/suppliers` + `backend/listings` — supplier profiles (Fernet-encrypted bank
  number), yards (PostGIS pins, delete-guard, 100m inference), 36 spec templates, listings
  CRUD + spec validation, publish gates via `listings/state.py` (**the only status
  writer**), photos (≤10, cover, reorder), duplicate, reports, public storefronts
  (suspended → 404).
- `backend/search` — read-only. `search/map` (server-side yard aggregation with
  authoritative counts), `search/list` (`group_by=asset|location`, keyset cursor),
  `geocode` (LocationIQ proxy, 24h cache, key never leaves the server). P95 ~170ms on 500
  listings, N+1-free.
- `backend/hires` + `backend/payments` — fee engine, availability engine, state machine,
  sweeps, handovers, disputes, refunds, payouts, reconciliation; Paystack behind a
  pluggable gateway (D-018).
- `backend/messaging` — two-party conversations, write-time contact masking, unread
  counters, participants-only access (**404 not 403**), Ably fan-out with keyless
  degradation to 15s polling.
- `backend/ops` — TOTP admin 2FA, founder dashboard, verification/payout/reports/hires/
  users queues, dispute resolution, suspension cascade, weekly digest, reconciliation
  history.
- `portal/` — the Supplier Portal (P1–P12), BFF cookie auth, vitest + Playwright smoke in
  CI. `mobile/` — the Hirer app, in progress. `packages/tokens/` — token build pipeline
  with a WCAG contrast gate.
- **Frozen OpenAPI** at `backend/openapi/schema.yml`. Contracts frozen at a wave's end are
  breaking-change-locked; changing one needs founder sign-off.

**Known open carry-overs** (details and IDs in `DECISIONS.md` observations and open items):
the Paystack dashboard webhook URL is unconfirmed in production; `LOCATIONIQ_KEY` and
`ABLY_API_KEY` are unset there; Termii sender approval is pending; and a dead Cloudflare
Workers Builds integration still posts a permanently-failing check on every commit.

## Deploy — merging ships nothing

Production is the founder's **VPS** (D-027): api + worker + PostGIS + portal as one Docker
Compose project (`infra/vps/docker-compose.prod.yml`) behind the host nginx ingress. API
`https://terminal-api.lab.perblis.com`, portal `https://terminal.lab.perblis.com`;
loopback `127.0.0.1:8100` (api) and `:8101` (portal).

**There is NO auto-deploy.** Deployment is one idempotent manual step, run as root on the
VPS:

```bash
/opt/terminal/repo/infra/vps/deploy.sh   # fetch+reset to origin/main, build, migrate, roll, health-check
```

It operates on the dedicated production checkout at `/opt/terminal/repo` (never the dev
worktree), with secrets in `/opt/terminal/.env`, and installs `/etc/cron.d/terminal` (hire
sweeps, reconciliation, digest, purges, nightly `pg_dump`). Full runbook: `DEPLOY.md`.

**Always check `git -C /opt/terminal/repo log -1` before deploying** — production
routinely lags `main` by several merges, so a deploy ships everything in between, not just
your change. Static is baked at `docker build`. Production **must** have `TERMII_API_KEY`
set (phone OTP fails loudly by design).

## Stack (fixed by D-009…D-013 — do not substitute)

- **Backend:** Django 6.0.x + DRF 3.17 + simplejwt + drf-spectacular + rest_framework_gis ·
  PostgreSQL 17 + PostGIS 3.5 · **django-tasks** (DB-broker tasks — no Redis, no Celery) ·
  self-hosted VPS via Docker Compose (D-027). Settings via django-environ
  (`settings/{base,dev,prod,test}.py`). Tooling: `uv`, `ruff`, `pytest` + factory-boy +
  freezegun + hypothesis.
- **Supplier Portal (`portal/`):** Next.js 15 App Router, containerised on the VPS,
  Tailwind + bespoke token-driven components (D-019/D-020), dark-only palette (D-028),
  TanStack Query, BFF cookie auth, `pnpm`.
- **Hirer app (`mobile/`):** Expo RN + TypeScript + expo-router, NativeWind, SecureStore,
  TanStack Query + Zustand, `pnpm`.
- **Maps:** MapLibre GL + OpenFreeMap tiles + LocationIQ geocoding (via backend proxy).
  **Never embed Mapbox or Google Maps SDKs.**
- **Services:** Paystack (collect-only) · Ably (realtime) · Termii (OTP) · Resend (email) ·
  Cloudflare R2 (media) · Sentry.
- **Budget guardrail:** total infra ≤ $25/month. Do not add paid services or tiers without
  founder approval.

## Commands

```bash
# backend
docker compose up -d                       # postgis + mailpit
cd backend && uv sync                      # or pip install -e .
./manage.py migrate && ./manage.py seed_spec_templates && ./manage.py runserver
./manage.py db_worker                      # django-tasks worker (separate shell)
pytest -x                                  # tests
pytest --cov                               # with coverage gates (85% hires/payments, 70% overall)
pytest path/to/test_file.py::test_name     # single test
ruff check . && ruff format .              # lint + format

# portal
cd portal && pnpm i && pnpm dev            # http://localhost:3000

# mobile
cd mobile && pnpm i && npx expo start      # Expo Go / dev client

# tokens
cd packages/tokens && pnpm build           # regenerates tailwind.tokens.js + tokens.ts
```

Dev keys absent ⇒ OTP prints to console, email lands in Mailpit (http://localhost:8025),
Ably falls back to polling. Paystack is always test-mode outside production.

## Architecture invariants (the load-bearing rules)

Non-negotiable and cutting across many files — violating them silently breaks the product
model. Full list and rationale in `design.md §2` and `§9`.

- **Lexicon everywhere.** Supplier/Hirer (never owner/renter), Hire (never booking), Yard,
  Live, On Hire, Service Fee — in code identifiers, API fields, DB columns, comments and UI
  copy alike. New code should never contain `renter`, `booking` or `owner`.
- **Money is integer kobo, always.** `BigIntegerField`, `core.money` helpers — no floats,
  no Decimals in domain logic, never store naira. UI shows whole naira.
- **Financial fields lock at acceptance.** `hire_value`, `service_fee`, `payout_amount`,
  `fee_basis` never mutate after the accept transition. Corrections are Refund records and
  Ops adjustments, never edits.
- **D-014: hirers never see the fee.** `service_fee` / `payout_amount` must not appear in
  any hirer-facing serializer, screen, email or receipt. Role-shaped serializers, tested.
- **All status changes go through the state machine.** `hires/state.py::apply()` is the
  only path that changes a hire's status; every transition writes an append-only
  `HireEvent`. No ORM `.status =` assignments elsewhere.
- **Webhooks are load-bearing.** Handlers verify HMAC, dedup by event, return 200 fast,
  process in tasks, and **verify before transition**. Never trust a client redirect to mark
  a hire paid.
- **Capacity-consuming writes** (`accept`, payment success) take `SELECT FOR UPDATE` on the
  listing row, re-check availability, then write — in one transaction. Side-effects via
  `transaction.on_commit`.
- **Views don't mutate; services do.** Business logic lives in `services.py` / `fees.py` /
  `state.py` / `availability.py`, pure where possible and unit-tested. No business logic in
  signals, serializers or views.
- **Simulate integrations, never simulate trust.** Missing dev keys ⇒ log or console
  fallback; never auto-verify a user or auto-pay a hire in any environment.

Backend apps: `core accounts suppliers listings search hires payments messaging ops`.

## API & contract conventions

- Routes under `/api/v1/`, cursor pagination, error envelope
  `{"error":{"code","message","fields?"}}` with stable codes (`availability_conflict`,
  `verification_required`, `basic_cap_exceeded`, `payment_window_expired`…).
- **Contract-first:** a module's drf-spectacular schema is published and reviewed before
  its portal or app wave consumes it. Regenerate and commit OpenAPI when contracts change.
  Breaking a wave-frozen contract requires founder sign-off.
- TypeScript: strict mode, eslint + prettier, zod schemas mirror DRF validation, TanStack
  Query for all server state.
- Design: colours, type and spacing come only from `packages/tokens` (no literal hex or px
  in components); money renders in mono.

## Wave gating (binding)

Work proceeds in **Waves 0–9** (`docs/waves/`). **Never start the next wave without
explicit founder approval** — finishing one wave does not authorize the next. Build each
wave as ordered vertical slices; demonstrate the exit criterion at wave end. If a wave
reveals a spec conflict, **stop and surface it** for a `DECISIONS.md` entry rather than
improvising. Each wave file is the complete build brief for that wave.

### Slicing within a wave

A **wave** is the founder-gated unit of value with one demonstrable exit criterion; a
**slice** is a vertical increment inside it that ships one real capability end-to-end
(model → service → API → tests).

- **Each slice stands alone:** it clears the full Definition of Done on its own —
  lexicon-clean, money and state-machine paths tested with coverage gates held, OpenAPI
  regenerated if contracts changed (frozen contracts untouched), reversible migration,
  `.env.example` exhaustive — and the suite is green before the next slice begins.
- **Land slices as separately-committed vertical slices** on the wave's branch, each
  building on the last; append an `Implementations.md` entry per slice.
- **Wave-frozen contracts freeze only at wave end**, so a later slice may still evolve an
  earlier slice's not-yet-frozen surface.
- The slice loop never authorizes the next **wave** — that still needs explicit founder
  approval.

Worked example — Wave 2 (Supply) shipped as: media + profile → yards → spec-templates +
seed → listings CRUD → publish/photos/state-machine → reports/storefronts.

## Definition of Done (every PR)

See `design.md §6` for the full checklist. Key gates: FSD behaviour and its acceptance
checks implemented with lexicon-clean naming; money and state-machine paths have explicit
tests and coverage gates hold; OpenAPI regenerated if contracts changed (frozen contracts
untouched); no D-014 leaks, no locked-field mutations, no state writes outside the machine;
migrations reversible; `.env.example` kept exhaustive.

## Tracking progress (`Implementations.md`)

`Implementations.md` is the append-only handoff log. **Keep it current**: append an entry
for every meaningful change — feature, fix, decision, deploy or blocker — so the next
instance can resume without re-deriving context. Newest entries at the bottom:

```
## YYYY-MM-DD HH:MM - short title
- tag: FEATURE | FIX | CHORE | DECISION | DEPLOY
- area: files / services touched
- summary: what changed
- reason: why
- change_ref: prior related entry   # optional
- notes: follow-ups, blockers, the next step
```

## Handoff protocol (when the founder says "prepare for handoff")

Run this checklist so a fresh instance can resume cold, then open a **docs-only draft PR**.
Do not start the next wave; this is documentation only.

1. **Sync to latest `main`** (`git fetch`, branch off `origin/main`) so the snapshot
   reflects everything merged, including PRs from other instances and tools.
2. **Reconcile docs to the code that actually shipped.** If the finished work changed a
   wave-frozen contract or schema, update the canonical specs
   (`docs/perblis-terminal-FSD.md`, `docs/perblis-terminal-TSD.md`) and **regenerate and
   commit the OpenAPI** (`backend/openapi/schema.yml`). Surface genuine spec conflicts as a
   `DECISIONS.md` entry rather than improvising.
3. **`Implementations.md`** — refresh the Current status block (what is built and deployed,
   what is pending, the founder-approved next wave with a "read `docs/waves/wave-N.md`
   first" pointer, plus carry-over gotchas: frozen contracts, required production env vars,
   local test-DB setup) and **append a log entry** in the standard format.
4. **`AGENTS.md`** — update the repository-state snapshot and re-date it.
5. **`docs/waves/README.md`** — update the status column (⏸ gated · 🟡 approved & in
   progress · ✅ done & signed off).
6. **Record known non-blocking follow-ups** in `Implementations.md` so they aren't lost.
7. **Commit on a `docs/...` branch → push → open a draft PR.** Keep it docs-only. Verify
   the cold-start path resolves: `AGENTS.md` → `Implementations.md` → `design.md` → the
   next wave file → its FSD/TSD sections.

## Git

Trunk-based: feature branches → PR → CI green → merge to `main`. **Merging does not
deploy** (D-027). Conventional-ish commit subjects, e.g. `hires: enforce payment-window
guard`.

## VPS migration secrets

This repo is **public**. Environment secrets live in the private
`NwabuezeChigozirim/vps-governance` repository under `secrets/Perblis_Terminal*.env`.
After cloning onto a new host: copy those files into `.env` and `backend/.env`, then follow
`VPS-BACKUP-SECRETS.md` in `vps-governance` to remove secrets from git there. **Never
commit a `.env` file to this repository.**
