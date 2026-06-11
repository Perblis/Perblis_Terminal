# Terminal — Engineering Guide for Coding Agents (design.md)
v1.0 · June 2026 · Read this FIRST, before writing any code in this repository.

Terminal is a map-first B2B marketplace for hiring heavy assets in Nigeria (Plant & Machinery, Trucks & Haulage, Warehousing, Terminals & Container Yards, Land & Staging). Suppliers list assets at Yards; Hirers discover them on the Map and pay through Terminal (Paystack, collect-only). The product is the **transaction record** — verified counterparties, locked terms, documented handovers.

---

## 1. Document authority (where truth lives)

Read order for any task: this file → the FSD section for your module → the TSD section for your module → the relevant `ux/` or `design-system/` chapter.

| Document | Authoritative for |
|---|---|
| `docs/v2/06_FSD_v2.md` (PDF: `docs/v2/pdf/`) | WHAT the system does — behaviour, rules, states, journeys |
| `docs/v2/07_TSD.md` (PDF: `docs/v2/pdf/`) | HOW — stack, schema, services, API contracts, waves |
| `docs/v2/DECISIONS.md` | Founder decisions D-001…D-016. **Binding. Never re-litigate in code.** |
| `docs/v2/02_System_Lexicon.md` | Every name in the system (UI, API, DB). |
| `docs/v2/05_Asset_Spec_Schemas.md` | Spec templates per asset class/type (seed data source) |
| `docs/v2/08_Design_System.md` + `docs/v2/design-system/` | All visual/UX language ("Heavy Duty"). Chapters win over summary. |
| `docs/v2/ux/` | Journeys, flows, screen-by-screen specs for app + portal |
| `docs/v2/01/03/04_*.md` | Context: product definition, MVP scope, architecture rationale |
| Policy Bible / FSD v1 / `docs/legacy-v1/` | Historical input only. **FSD v2 wins all conflicts.** |

## 2. The ten commandments of this codebase

1. **Use the Lexicon everywhere.** Supplier/Hirer (never owner/renter), Hire (never booking), Yard (supplier location), Live (published listing), On Hire (in-use state), Service Fee. This applies to **code identifiers, API fields, DB columns, comments, and UI copy** equally. `grep -ri "renter\|booking\b\|owner" ` should return nothing in new code (except `parent_hire`-style approved names).
2. **Money is integer kobo, always.** `BigIntegerField`, `core.money` helpers, no floats, no Decimals in domain logic. UI shows whole naira.
3. **Financial fields are locked at acceptance.** `hire_value`, `service_fee`, `payout_amount`, `fee_basis` never mutate after the accept transition. Corrections = Refund records + Ops adjustments, never edits.
4. **D-014: hirers never see the fee.** `service_fee`/`payout_amount` must not appear in any hirer-facing serializer output, screen, email, or receipt. Role-shaped serializers, tested.
5. **All state changes go through the state machine.** `hires/state.py::apply()` is the only way a hire changes status. Every transition writes a `HireEvent`. No ORM `.status =` assignments elsewhere. `hire_events` is append-only.
6. **Webhooks are the load-bearing wall.** Paystack handlers: verify HMAC, dedup by `event_id`, return 200 fast, process in tasks, verify-before-transition. Client redirects are never trusted.
7. **Concurrency contract:** any write that consumes listing capacity (`accept`, `payment success`) takes `SELECT FOR UPDATE` on the listing row, re-checks availability, then writes — inside one transaction. Side-effects via `transaction.on_commit`.
8. **Views don't mutate; services do.** Business logic lives in `services.py` / `fees.py` / `state.py` / `availability.py` — pure where possible, unit-tested in isolation. No business logic in signals, serializers, or views.
9. **Contract-first:** a module's drf-spectacular schema is published (and reviewed) before its portal/app wave consumes it. Breaking an already-frozen contract requires founder sign-off.
10. **Simulate integrations, never simulate trust.** Missing third-party keys in dev ⇒ console/log fallback (OTP printed, emails to mailpit) — the system never crashes for a missing key, and never fakes a *state* (no auto-verified users, no auto-paid hires, in any environment).

## 3. Stack (fixed by D-009…D-013 — do not substitute)

Backend: **Django 6.0.x + DRF 3.17** + simplejwt + drf-spectacular + rest_framework_gis · PostgreSQL 17 + PostGIS 3.5 · **django-tasks** (DB broker — **no Redis, no Celery**) · Railway (api 512MB + worker 256MB + DB).
Frontend: Supplier Portal = **Next.js 15 App Router on Cloudflare Workers** (@opennextjs/cloudflare), Tailwind + shadcn/ui, TanStack Query, BFF cookie auth. Hirer app = **Expo RN + TypeScript + expo-router**, NativeWind, SecureStore, TanStack Query + Zustand.
Maps: **MapLibre GL** (web + maplibre-react-native) + OpenFreeMap tiles + LocationIQ geocoding via backend proxy. **Never embed Mapbox or Google Maps SDKs.**
Services: Paystack (collect-only) · Ably (realtime) · Termii (OTP) · Resend (email) · Cloudflare R2 (media; public + private buckets) · Sentry.
Budget guardrail: total infra must stay ≤ $25/month — do not add paid services or tiers without founder approval.

## 4. Repository map

```
backend/            Django (apps: core accounts suppliers listings search hires payments messaging ops)
portal/             Next.js Supplier Portal (Workers)
app/                Expo hirer app ("Terminal")
packages/tokens/    design tokens → tailwind.tokens.js + tokens.ts + glyphs/
docs/               all specs; docs/runbooks/ operational procedures
docker-compose.yml  dev: postgis + mailpit
```

## 5. Conventions

**Python:** ruff (lint+format, config in pyproject) · type hints on services · pytest + factory-boy + freezegun + hypothesis · migrations reviewed, never squashed post-deploy · settings via django-environ (`settings/{base,dev,prod,test}.py`).
**TypeScript:** strict mode · eslint + prettier · zod schemas mirror DRF validation · TanStack Query for all server state (no ad-hoc fetch state) · components follow design-system chapters (use the shared tokens; portal restyles shadcn, app uses NativeWind — see 08 §7).
**API:** `/api/v1/`, cursor pagination, error envelope `{"error":{"code","message","fields?"}}` with stable codes (`availability_conflict`, `verification_required`, `basic_cap_exceeded`, `payment_window_expired`…). Throttles per TSD §3.8.
**Git:** trunk-based, feature branches → PR → CI green → merge to `main` (auto-deploys backend+portal). Conventional-ish commit subjects ("hires: enforce payment-window guard"). Never commit secrets; `.env.example` stays exhaustive.
**Design:** colors/type/spacing only from `packages/tokens` (no literal hex/px in components) · status colors + class hues are fixed (08 §2.1) · money in IBM Plex Mono · smallest text 13px portal / 14px app · amber text on white is forbidden.

## 6. Definition of Done (every PR)

- [ ] FSD behaviour implemented incl. its **Acceptance checks**; lexicon-clean naming
- [ ] Tests: new logic covered; money/state-machine paths have explicit cases; coverage gates hold (85% hires/payments, 70% overall)
- [ ] OpenAPI schema regenerated and committed if contracts changed (and wave-frozen contracts untouched)
- [ ] No D-014 leaks (fee fields in hirer payloads), no locked-field mutations, no state writes outside the machine
- [ ] Sentry breadcrumbs/log context on new failure paths; migrations reversible; `.env.example` updated
- [ ] UI matches design-system chapter (tokens only, states: loading/empty/error designed, not defaulted)

## 7. Build process — wave gating (binding)

Work proceeds in **Waves 0–9** (TSD §10). **Never start the next wave without explicit founder approval** — this is a standing instruction, not a preference. Within a wave, ship vertical slices; at wave end, demonstrate the exit criterion. If a wave reveals a spec conflict, stop and surface it (the founder updates DECISIONS.md) rather than improvising.

## 8. Commands (dev quickstart)

```bash
# backend
docker compose up -d                       # postgis + mailpit
cd backend && uv sync                      # or pip install -e .
./manage.py migrate && ./manage.py seed_spec_templates && ./manage.py runserver
./manage.py db_worker                      # django-tasks worker (second shell)
pytest -x                                  # tests; pytest --cov for gates
# portal
cd portal && pnpm i && pnpm dev            # http://localhost:3000
# app
cd app && pnpm i && npx expo start         # Expo Go / dev client
# tokens
cd packages/tokens && pnpm build           # regenerates tailwind.tokens.js + tokens.ts
```
Dev keys absent ⇒ OTP prints to console, email lands in mailpit (http://localhost:8025), Ably falls back to polling. Paystack always test-mode outside prod.

## 9. Things that look like good ideas but are wrong here

- Adding Redis/Celery "for robustness" → D-010 says no; the DB is the broker at this scale.
- Showing hirers a fee breakdown "for transparency" → violates D-014; transparency is the ToS's job.
- Letting `Requested` hires hold dates → breaks the first-to-pay model (FSD §7.1); only Accepted-in-window/Confirmed/On-Hire hold.
- Trusting the Paystack redirect to mark paid → webhook + verify only.
- Auto-approving verifications in dev seeds → seed Verified users explicitly instead; the approval *flow* must stay real.
- Client-side distance calculation or client-side yard grouping → server is authoritative (TSD §3.7).
- "Cleaning up" old hire events or editing them → append-only, forever.
- Rounding money with floats, or storing naira → integer kobo only.
- Adding a paid SaaS tier/service → $25/month ceiling; ask first.

## 10. When the docs don't answer it

1. Check DECISIONS.md, then the FSD's module section, then the TSD's, then companion docs.
2. Still ambiguous → make the smallest reversible choice consistent with the lexicon and invariants, flag it in the PR description under **"Spec gaps"**, and surface it to the founder for a DECISIONS.md entry.
3. Never silently invent: new fees, new states, new statuses, new user-facing vocabulary, or new third-party services.
