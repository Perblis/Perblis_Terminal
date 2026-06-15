# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Read this first

**`design.md` (repo root) is the canonical engineering guide and overrides anything summarized here.** Read it before writing any code. This file is a fast map to that material, not a replacement.

Terminal is a map-first B2B marketplace for hiring heavy assets in Nigeria (Plant & Machinery, Trucks & Haulage, Warehousing, Terminals & Container Yards, Land & Staging). Suppliers list assets at Yards; Hirers discover them on the Map and pay through Terminal (Paystack, collect-only). The product is the **transaction record**.

## Current state of the repo

This is a **specs-and-scaffold monorepo before the build starts**. `backend/`, `portal/`, `app/`, and `packages/tokens/` are empty (`.gitkeep`) — all real content is in `docs/` and `design.md`. Do not assume code exists; you are likely creating it. Work is gated (see Wave gating below), so confirm the active wave before building a module.

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

Work proceeds in **Waves 0–9** (`docs/waves/`, TSD §10). **Never start the next wave without explicit founder approval** — finishing one wave does not authorize the next. Ship vertical slices within a wave; demonstrate the exit criterion at wave end. If a wave reveals a spec conflict, **stop and surface it** for a `DECISIONS.md` entry rather than improvising. Each wave file is the complete build brief for that wave.

## Definition of Done (every PR)

See `design.md §6` for the full checklist. Key gates: FSD behaviour + its Acceptance checks implemented with lexicon-clean naming; money/state-machine paths have explicit tests and coverage gates hold; OpenAPI regenerated if contracts changed (frozen contracts untouched); no D-014 leaks, no locked-field mutations, no state writes outside the machine; migrations reversible; `.env.example` kept exhaustive.

## Git

Trunk-based: feature branches → PR → CI green → merge to `main` (auto-deploys backend + portal). Conventional-ish commit subjects, e.g. `hires: enforce payment-window guard`.
