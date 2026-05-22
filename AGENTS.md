# AGENTS.md

## Project Overview

**Terminal** is a Django REST API backend for a heavy asset leasing marketplace. The platform connects owners of heavy equipment, vehicles, warehouses, terminals, and container yards with renters. Built with Django + Django REST Framework + PostGIS.

## Cursor Cloud specific instructions

### System Dependencies

The environment requires PostgreSQL 16 with PostGIS 3 and geospatial libraries (GDAL, GEOS, PROJ). These are installed via:
```
sudo apt-get install -y postgresql postgresql-contrib postgis postgresql-16-postgis-3 gdal-bin libgdal-dev libgeos-dev libproj-dev
```

### Environment Variable Override (Critical)

The Cloud Agent VM has injected secrets (`DJANGO_SETTINGS_MODULE`, `DATABASE_URL`, etc.) that point at a remote Supabase database. **All Django commands must be prefixed** with overrides to use the local dev database:
```
DJANGO_SETTINGS_MODULE=config.settings.development DATABASE_URL= python manage.py <command>
```
Forgetting this will silently run against the non-local database.

### Starting Services

1. **PostgreSQL**: `sudo service postgresql start` (must be running before Django)
2. **Django dev server**: `cd /agent/repos/Terminal-Server && source venv/bin/activate && DJANGO_SETTINGS_MODULE=config.settings.development DATABASE_URL= python manage.py runserver 0.0.0.0:8000`
3. **Owner Web Portal** (optional): `cd /agent/repos/Terminal-Web && npm run dev` (Next.js 16, port 3000; separate repo)
4. **Django Q2 worker** (optional, for background tasks): `cd /agent/repos/Terminal-Server && source venv/bin/activate && DJANGO_SETTINGS_MODULE=config.settings.development DATABASE_URL= python manage.py qcluster`

### Database

- Database: `terminal_dev` on `localhost:5432`
- User/password: `postgres`/`postgres`
- PostGIS extension is already enabled
- Superuser: `admin@terminal.app` / `admin123456`

### Key Commands

| Task | Command |
|------|---------|
| Run dev server | `python manage.py runserver 0.0.0.0:8000` |
| Run migrations | `python manage.py migrate` |
| Create migrations | `python manage.py makemigrations` |
| Run tests | `pytest` (uses `pytest.ini`; do NOT use `python manage.py test`) |
| Lint | `ruff check .` |
| Django check | `python manage.py check` |
| Collect static | `python manage.py collectstatic --noinput` |

### Important Endpoints

- Health check: `GET /health/`
- API docs (Swagger): `/api/docs/`
- Admin panel: `/admin/`
- API schema: `/api/schema/`

### Settings

- Development settings: `config.settings.development` (default in manage.py)
- The `.env` file in project root is read by django-environ
- `AUTH_USER_MODEL` is `accounts.User` (email-based, not username)

### Related repositories

- **Mobile app (Expo / React Native):** design system and app code live in [Terminal-Mobile](https://github.com/Nwabukin/Terminal-Mobile.git) (separate repo).

### Gotchas

- PostgreSQL must be started before running any Django management commands (migrations, server, etc.)
- The User model uses email as `USERNAME_FIELD`, not username. Use `--email` flag with `createsuperuser`. With `--noinput`, you must also pass `--phone`, `--first_name`, and `--last_name`.
- The project uses `django.contrib.gis` (GeoDjango), which requires PostGIS and system GIS libraries.
- Virtual environment is at `venv/` in the repo root — always activate before running commands: `source venv/bin/activate`.
- Test accounts (password `test1234!`): `owner1@test.com`, `owner2@test.com`, `renter1@test.com`, `renter2@test.com`, `dual@test.com`. Run `DJANGO_SETTINGS_MODULE=config.settings.development DATABASE_URL= python manage.py shell < scripts/seed.py` to create them.
- `next lint` is removed in Next.js 16. The frontend ESLint config (`.eslintrc.json`) needs migration to flat config format (ESLint 9+). TypeScript typecheck works: `cd owner-web && npx tsc --noEmit`.
- All Django management commands (migrate, test, runserver, etc.) need the env overrides or they hit a remote non-local DB.
- The `ruff` linter is installed into the venv, not globally. Always activate venv first: `source /workspace/venv/bin/activate && ruff check .`
- One pre-existing test failure: `messaging/tests/test_models.py::TestMessagingServices::test_publish_to_ably_without_key_prints_to_console` (Ably console fallback test). Not environment-related.
- `LoginRateThrottle` has a class-level `THROTTLE_RATES` that overrides development settings (`5/min` with 900s window). If you exhaust it during testing, restart the Django server to reset in-memory cache. The development settings rate (`1000/min`) does NOT take effect because of the class attribute.
- The workspace path in Cloud Agent VMs is `/agent/repos/Terminal-Server` (not `/workspace`). The owner web portal is in a separate repo at `/agent/repos/Terminal-Web`.

### Owner Web Portal (owner-web/)

Next.js 16 (App Router, Turbopack) owner portal in a separate repo at `/agent/repos/Terminal-Web`. It uses JWT from the Django API (see `src/lib/api/client.ts` and BFF routes under `src/app/api/auth/`).

- **Lockfile**: `package-lock.json` → use `npm install`
- **Lint**: `npm run lint` (ESLint 9 flat config) and `npm run typecheck` (`tsc --noEmit`)
- **Dev server**: `cd /agent/repos/Terminal-Web && npm run dev` (port 3000; API on 8000)
- **Env**: Copy `.env.example` to `.env.local` in the Terminal-Web repo. Default `NEXT_PUBLIC_API_BASE_URL` is `http://localhost:8000` (no trailing slash).
- **Auth guarding**: Protected routes use `(owner)/layout.tsx` with server-side `getSession()` (no root `middleware.ts`).
- **Test accounts**: Same as backend (`owner1@test.com`, etc.; password `test1234!`). Seed via `python manage.py shell < scripts/seed.py`.
