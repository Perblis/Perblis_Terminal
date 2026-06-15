# Terminal

**Map-first B2B marketplace for hiring heavy assets in Nigeria** — Plant & Machinery,
Trucks & Haulage, Warehousing, Terminals & Container Yards, and Land & Staging.

Suppliers list assets at Yards; Hirers discover them on the Map and pay through
Terminal (Paystack, collect-only). The product is the **transaction record** —
verified counterparties, locked terms, documented handovers.

## Repository layout

```
backend/          Django + DRF API (PostGIS, django-tasks)         — building
portal/           Supplier Portal · Next.js 15 on Cloudflare Workers — building
app/              Hirer app · Expo React Native                     — scaffolds in Wave 8
packages/tokens/  Shared design tokens → Tailwind/NativeWind/CSS    — building
docs/             Specifications and decisions
  v2/             Canonical specs (FSD v2.1, TSD v2.1, Design System, UX)
  waves/          Per-wave build briefs and gating rules
scripts/          Repo tooling (md→pdf, etc.)
docker-compose.yml  Dev services: PostGIS + Mailpit
DEPLOY.md         Production bring-up runbook (Railway · Workers · R2)
```

## Start here

| If you are… | Read first |
|---|---|
| A coding agent | [design.md](design.md) — engineering guide, commandments, conventions, wave gating |
| Picking up a build wave | [docs/waves/README.md](docs/waves/README.md) → the wave file |
| Reviewing product behaviour | [docs/v2/06_FSD_v2.md](docs/v2/06_FSD_v2.md) ([PDF](docs/v2/pdf/Terminal_FSD_v2.1.pdf)) |
| Reviewing the technical design | [docs/v2/07_TSD.md](docs/v2/07_TSD.md) ([PDF](docs/v2/pdf/Terminal_TSD_v2.1.pdf)) |
| Checking a founder decision | [docs/v2/DECISIONS.md](docs/v2/DECISIONS.md) (D-001…D-016, binding) |

## Prerequisites

- **Docker** (PostGIS + Mailpit for local dev)
- **[uv](https://docs.astral.sh/uv/)** — Python toolchain; provisions Python 3.12+ for the backend
- **Node 22+** and **[pnpm](https://pnpm.io/) 10+** — for `portal/` and `packages/tokens/`
- **GDAL / GEOS / PROJ** on the host — GeoDjango runtime
  (`apt-get install gdal-bin libgdal-dev binutils libproj-dev`; macOS: `brew install gdal`)

## Dev quickstart

### Backend (API + worker)

```bash
docker compose up -d                  # PostGIS (5432) + Mailpit (UI: http://localhost:8025)

cd backend
uv sync                               # install deps into .venv
cp .env.example .env                  # fill in as needed; absent keys fall back to console/log

uv run python manage.py migrate
uv run python manage.py runserver     # http://localhost:8000

# In a second shell — the django-tasks worker (Postgres-brokered, no Redis):
uv run python manage.py db_worker
```

Sanity check: `GET /healthz` (app + DB), `GET /readyz` (DB + integration status),
API docs at `/api/docs/`.

> Settings default to `settings.dev` (`manage.py`). Override with
> `DJANGO_SETTINGS_MODULE=settings.{dev,prod,test}` when needed.

### Tests, lint, types

```bash
cd backend
uv run pytest                         # full suite
uv run pytest --cov                   # with coverage gates (85% hires/payments, 70% overall)
uv run pytest path/to/test_file.py::test_name   # a single test
uv run ruff check . && uv run ruff format .      # lint + format
uv run python scripts/check_env_example.py       # .env.example completeness
```

### Design tokens

```bash
cd packages/tokens
pnpm install
pnpm build            # validates the WCAG contrast gate, emits tailwind.tokens.cjs,
                      # tokens.ts, tokens.css, admin.css (consumed by portal/app)
```

Source of truth is `packages/tokens/src/*.json` — no hex/px literals live in
component code. The portal and app consume the **built artifacts**, never the source.

### Supplier Portal

```bash
pnpm install          # from the repo root (pnpm workspace)
cd portal
pnpm dev              # http://localhost:3000 (builds tokens first via predev)
pnpm build            # production build (also runs the tokens build)
```

### Local dev fallbacks

With dev keys absent: OTP prints to the console, email lands in **Mailpit**
(http://localhost:8025), Ably falls back to polling. Paystack is always test-mode
outside production. The system never crashes on a missing integration key and
never fakes a trusted state (no auto-verified users, no auto-paid hires).

## Continuous integration

GitHub Actions, path-filtered:

- **`.github/workflows/backend.yml`** — ruff (lint + format), mypy, `.env.example`
  completeness, migrations-in-sync, pytest against a PostGIS service container, coverage gates.
- **`.github/workflows/portal.yml`** — eslint, `tsc`, and the Next.js build (tokens built first).

Trunk-based: feature branch → PR → CI green → merge to `main` (auto-deploys backend + portal).

## Deployment

Production is Railway (api + worker + PostgreSQL 17 / PostGIS 3.5), Cloudflare
Workers (portal), and Cloudflare R2 (media), with total fixed infra ≤ $25/month.
See **[DEPLOY.md](DEPLOY.md)** for the step-by-step bring-up.

## Build waves

Work proceeds in gated **Waves 0–9** (`docs/waves/`, TSD §10). **No wave starts
without explicit founder approval** — finishing one wave does not authorize the
next. See `design.md §7`.
