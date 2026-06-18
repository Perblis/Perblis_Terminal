# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Read this first

**`design.md` (repo root) is the canonical engineering guide and overrides anything summarized here.** Read it before writing any code. This file is a fast map to that material, not a replacement.

Terminal is a map-first B2B marketplace for hiring heavy assets in Nigeria (Plant & Machinery, Trucks & Haulage, Warehousing, Terminals & Container Yards, Land & Staging). Suppliers list assets at Yards; Hirers discover them on the Map and pay through Terminal (Paystack, collect-only). The product is the **transaction record**.

## Current state of the repo

**Waves 0, 1, 2 are complete and merged; the backend is deployed. Wave 3 (Discovery — Map Search & Yard Aggregation) is the next wave — GATED on explicit founder approval (not yet started).** This snapshot can lag — always reconcile against `Implementations.md` and the code itself (see Session start protocol).

- `backend/` — `core` (BaseModel UUIDv7, `money`, permissions, cursor pagination, error envelope, `/healthz`+`/readyz`, heartbeat task, `manage.py deploy` advisory-locked migrate+seed) and `accounts` — **Wave 1 fully built**: register, **independent phone (SMS) + email (Resend) OTP verification** (both required for login), JWT login/refresh/logout (rotating + blacklist + `tv` session-invalidation claim), no-enumeration password reset, `GET/PATCH/DELETE me`, supplier activation, identity/business verification docs (private R2 + Ops admin review queue), soft-delete + NDPR purge.
- `backend/` — **Wave 2 fully built** (`suppliers` + `listings`): supplier profiles (Fernet-encrypted bank #), yards (PostGIS pins, delete-guard, 100m inference), 36 spec templates, listings CRUD + spec validation/version stamp, publish gates via `listings/state.py` (the only status writer), photos (≤10, cover, reorder), duplicate, reports, public storefronts (suspended→404), `core/media` presign pipeline. Migrations: accounts `0001`–`0005`, suppliers `0001`–`0002`, listings `0001`–`0005`. **Frozen OpenAPI at `backend/openapi/schema.yml`** (Wave 2 contracts breaking-change-locked). Domain apps `search hires payments messaging ops` are registered but **empty** — they are Waves 3+ (Wave 3 builds `search`).
- **Admin:** the Django admin is themed as the **"Terminal Ops Console"** (Heavy Duty CSS via WhiteNoise + manifest static storage), live in prod. This is **visual-only** — the functional Ops Console (queues, dashboards, 2FA, disputes) remains **Wave 6**.
- `packages/tokens/` — token build pipeline (WCAG contrast gate + emitted artifacts). `portal/` — Next.js hello-world proving the token pipeline. CI (`backend.yml`, `portal.yml`) green on `main`.
- **Deploy:** backend api + worker + PostGIS live on Railway (`/healthz` green). Static is baked at `docker build` (collectstatic + WhiteNoise manifest in the image). Prod **must** have `TERMII_API_KEY` set (phone OTP fails loudly rather than falling back); **Termii sender approval is still pending** (real SMS 502 → Ops admin channel-verify is the interim onboarding path). The Supplier Portal on Cloudflare Workers is **still pending** — Wave 0's portal exit criterion remains open.
- **Decisions since the specs:** D-017 switched the MVP payment provider to **Bachs.io** (collect-only), superseding Paystack in D-006.

## Session start protocol (do this first, every session)

Before acting on a task, build context and locate yourself in the build — do not assume the snapshot above is current:

1. **Read `Implementations.md`** (repo root) — the running agent progress log. Its newest entries are the fast truth of what was just done, deployed, or left blocked, so any instance can take over mid-stream.
2. **Read `design.md`**, then the document-authority docs (below) for your task area.
3. **Determine the precise wave status from code, not just docs.** Check backend apps (which have models/migrations), `/api/v1/` routes, tests, and `docs/waves/`. If `docs/waves/README.md`'s status column disagrees with the code or `Implementations.md`, trust the code — then reconcile the docs.
4. **Identify the next wave and confirm it's founder-approved** before building it (wave gating is binding — design.md §7). Finishing one wave never authorizes the next.

## Tracking progress (`Implementations.md`)

`Implementations.md` (repo root) is the append-only handoff log. **Keep it current**: append an entry for every meaningful change — feature, fix, decision, deploy, or blocker — so the next instance can resume without re-deriving context. Newest entries at the bottom. Entry format:

```
## YYYY-MM-DD HH:MM - <short title>
- tag: FEATURE | FIX | CHORE | DECISION | DEPLOY
- area: <files / services touched>
- summary: <what changed>
- reason: <why>
- change_ref: <prior related entry>   # optional
- notes: <follow-ups, blockers, the next step>
```

## Handoff protocol (when the founder says "prepare for handoff")

When the founder asks to **"prepare for handoff"** (or "hand off", "ready for the next instance", etc.), run this checklist so a fresh instance can resume cold — then open a **docs-only draft PR** with the result. Do not start the next wave; this is documentation only.

1. **Sync to latest `main`** (`git fetch` + work from a fresh branch off `origin/main`) so the snapshot reflects everything merged — including PRs merged from other instances/tools.
2. **Reconcile docs to the code that actually shipped.** If the just-finished work changed any wave-frozen contract or schema, update the cited specs (`docs/v2/06_FSD_v2.md`, `docs/v2/07_TSD.md`) and **regenerate + commit the OpenAPI** (`backend/openapi/schema.yml`). Surface genuine spec conflicts as a `DECISIONS.md` entry rather than improvising.
3. **`Implementations.md`** — refresh the **Current status** block (what's built/deployed, what's pending, the founder-approved **next wave** with a "read `docs/waves/wave-N.md` first" pointer, plus carry-over gotchas: frozen contracts, required prod env vars, local test-DB setup) and **append a log entry** in the standard format.
4. **`CLAUDE.md`** — update the **"Current state of the repo"** snapshot (waves done/deployed, next wave).
5. **`docs/waves/README.md`** — update the **status column** (✅ done · 🟡 approved & in progress · ⏸ gated).
6. **Record known non-blocking follow-ups** (small bugs, copy nits, deferred items) in `Implementations.md` so they aren't lost.
7. **Commit on a `docs/...` branch → push → open a draft PR.** Keep it docs-only (no behavior change). Verify the new-instance reading path resolves: Implementations.md → design.md → the next wave file → its FSD/TSD sections.

## Document authority (where truth lives)

Read order for any task: `design.md` → `docs/waves/README.md` → the wave file → the FSD/TSD sections it cites → companion `docs/v2/` docs.

| Document | Authoritative for |
|---|---|
| `docs/v2/06_FSD_v2.md` | WHAT the system does — behaviour, rules, states, journeys |
| `docs/v2/07_TSD.md` | HOW — stack, schema, services, API contracts, waves |
| `docs/v2/DECISIONS.md` | Founder decisions D-001…D-016. **Binding — never re-litigate in code.** |
| `docs/v2/02_System_Lexicon.md` | Every approved name (UI, API, DB) |
| `docs/v2/05_Asset_Spec_Schemas.md` | Spec templates per asset class (seed data source) |
| `docs/v2/08_Design_System.md` + `docs/v2/design-system/` | Visual/UX language ("Heavy Duty"); chapters win over the summary |
| `docs/v2/ux/` | Journeys, flows, screen-by-screen specs |
| `docs/legacy-v1/`, Policy Bible, FSD v1 | Historical input only — **FSD v2 wins all conflicts** |

PDF mirrors live in `docs/v2/pdf/`. `scripts/md2pdf.py` regenerates them.

## Stack (fixed by D-009…D-013 — do not substitute)

- **Backend:** Django 6.0.x + DRF 3.17 + simplejwt + drf-spectacular + rest_framework_gis · PostgreSQL 17 + PostGIS 3.5 · **django-tasks** (DB-broker tasks — no Redis, no Celery) · Railway hosting. Settings via django-environ (`settings/{base,dev,prod,test}.py`). Tooling: `uv`, `ruff` (lint+format), `pytest` + factory-boy + freezegun + hypothesis.
- **Supplier Portal (`portal/`):** Next.js 15 App Router on Cloudflare Workers (@opennextjs/cloudflare), Tailwind + shadcn/ui, TanStack Query, BFF cookie auth, `pnpm`.
- **Hirer app (`app/`):** Expo RN + TypeScript + expo-router, NativeWind, SecureStore, TanStack Query + Zustand, `pnpm`.
- **Maps:** MapLibre GL + OpenFreeMap tiles + LocationIQ geocoding (via backend proxy). **Never embed Mapbox or Google Maps SDKs.**
- **Services:** Paystack (collect-only) · Ably (realtime) · Termii (OTP) · Resend (email) · Cloudflare R2 (media) · Sentry.
- **Budget guardrail:** total infra ≤ $25/month. Do not add paid services/tiers without founder approval.

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

# app
cd app && pnpm i && npx expo start         # Expo Go / dev client

# tokens
cd packages/tokens && pnpm build           # regenerates tailwind.tokens.js + tokens.ts
```

Dev keys absent ⇒ OTP prints to console, email lands in Mailpit (http://localhost:8025), Ably falls back to polling. Paystack is always test-mode outside prod.

## Architecture invariants (the load-bearing rules)

These are non-negotiable and cut across many files — violating them silently breaks the product model. Full list and rationale in `design.md §2` and `§9`.

- **Lexicon everywhere.** Supplier/Hirer (never owner/renter), Hire (never booking), Yard, Live, On Hire, Service Fee — in code identifiers, API fields, DB columns, comments, and UI copy alike. New code should never contain `renter`, `booking`, or `owner`.
- **Money is integer kobo, always.** `BigIntegerField`, `core.money` helpers — no floats, no Decimals in domain logic, never store naira. UI shows whole naira.
- **Financial fields lock at acceptance.** `hire_value`, `service_fee`, `payout_amount`, `fee_basis` never mutate after the accept transition. Corrections are Refund records + Ops adjustments, never edits.
- **D-014: hirers never see the fee.** `service_fee`/`payout_amount` must not appear in any hirer-facing serializer, screen, email, or receipt. Use role-shaped serializers, tested.
- **All status changes go through the state machine.** `hires/state.py::apply()` is the only path that changes a hire's status; every transition writes an append-only `HireEvent`. No ORM `.status =` assignments elsewhere.
- **Webhooks are load-bearing.** Paystack handlers verify HMAC, dedup by `event_id`, return 200 fast, process in tasks, verify-before-transition. Never trust client redirects to mark a hire paid.
- **Capacity-consuming writes** (`accept`, payment success) take `SELECT FOR UPDATE` on the listing row, re-check availability, then write — in one transaction. Side-effects via `transaction.on_commit`.
- **Views don't mutate; services do.** Business logic lives in `services.py` / `fees.py` / `state.py` / `availability.py`, pure where possible and unit-tested. No business logic in signals, serializers, or views.
- **Simulate integrations, never simulate trust.** Missing dev keys ⇒ log/console fallback; never auto-verify users or auto-pay hires in any environment.

Backend apps (per TSD): `core accounts suppliers listings search hires payments messaging ops`.

## API & contract conventions

- Routes under `/api/v1/`, cursor pagination, error envelope `{"error":{"code","message","fields?"}}` with stable codes (`availability_conflict`, `verification_required`, `basic_cap_exceeded`, `payment_window_expired`…).
- **Contract-first:** a module's drf-spectacular schema is published and reviewed before its portal/app wave consumes it. Regenerate and commit OpenAPI when contracts change. Breaking a wave-frozen contract requires founder sign-off.
- TypeScript: strict mode, eslint + prettier, zod schemas mirror DRF validation, TanStack Query for all server state.
- Design: colors/type/spacing come only from `packages/tokens` (no literal hex/px in components); money renders in IBM Plex Mono.

## Wave gating (binding)

Work proceeds in **Waves 0–9** (`docs/waves/`, TSD §10). **Never start the next wave without explicit founder approval** — finishing one wave does not authorize the next. Build each wave as ordered vertical slices (see below); demonstrate the exit criterion at wave end. If a wave reveals a spec conflict, **stop and surface it** for a `DECISIONS.md` entry rather than improvising. Each wave file is the complete build brief for that wave.

### Slicing within a wave

A **wave** is the founder-gated unit of value with one demonstrable exit criterion; a **slice** is a vertical increment inside it that ships one real capability end-to-end (model → service → API → tests). Plan and build every wave as an ordered set of slices:

- **Each slice stands alone:** it clears the full **Definition of Done** (below) on its own — lexicon-clean, money/state-machine tested with coverage gates held, OpenAPI regenerated if contracts changed (frozen contracts untouched), reversible migration, `.env.example` exhaustive — and the suite is green before the next slice begins.
- **Land slices as clear, separately-committed vertical slices** on the wave's branch, each building on the last; append an `Implementations.md` entry per slice.
- **Wave-frozen contracts freeze only at wave end**, so a later slice may still evolve an earlier slice's not-yet-frozen surface.
- The slice loop never authorizes the next **wave** — that still needs explicit founder approval.

Worked example — Wave 2 (Supply) shipped as: media+profile → yards → spec-templates+seed → listings CRUD → publish/photos/state-machine → reports/storefronts.

## Definition of Done (every PR)

See `design.md §6` for the full checklist. Key gates: FSD behaviour + its Acceptance checks implemented with lexicon-clean naming; money/state-machine paths have explicit tests and coverage gates hold; OpenAPI regenerated if contracts changed (frozen contracts untouched); no D-014 leaks, no locked-field mutations, no state writes outside the machine; migrations reversible; `.env.example` kept exhaustive.

## Git

Trunk-based: feature branches → PR → CI green → merge to `main` (auto-deploys backend + portal). Conventional-ish commit subjects, e.g. `hires: enforce payment-window guard`.
