# AGENTS.md

## Project Overview

**Terminal** is a Django REST API backend for a heavy asset leasing marketplace. The platform connects owners of heavy equipment, vehicles, warehouses, terminals, and container yards with renters. Built with Django + Django REST Framework + PostGIS.

## Cursor Cloud specific instructions

### System Dependencies

The environment requires PostgreSQL 16 with PostGIS 3 and geospatial libraries (GDAL, GEOS, PROJ). These are installed via:
```
sudo apt-get install -y postgresql postgresql-contrib postgis postgresql-16-postgis-3 gdal-bin libgdal-dev libgeos-dev libproj-dev
```

### Starting Services

1. **PostgreSQL**: `sudo service postgresql start` (must be running before Django)
2. **Django dev server**: `cd /workspace && source venv/bin/activate && python manage.py runserver 0.0.0.0:8000`
3. **Django Q2 worker** (optional, for background tasks): `cd /workspace && source venv/bin/activate && python manage.py qcluster`

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
| Run tests | `python manage.py test` |
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

### Mobile WAVE Files

The repo contains `MOBILE_WAVE_0{0..4}_*.md` files — step-by-step agent task files for building the Terminal React Native (Expo) mobile app. They reference the design system at `https://github.com/Nwabukin/Terminal-Mobile.git`. Each wave builds on the previous one and contains exact code, API contracts, and a Definition of Done checklist.

### Gotchas

- PostgreSQL must be started before running any Django management commands (migrations, server, etc.)
- The User model uses email as `USERNAME_FIELD`, not username. Use `--email` flag with `createsuperuser`.
- The project uses `django.contrib.gis` (GeoDjango), which requires PostGIS and system GIS libraries.
- Virtual environment is at `/workspace/venv/` — always activate before running commands.
- Test accounts (password `test1234!`): `owner1@test.com`, `owner2@test.com`, `renter1@test.com`, `renter2@test.com`, `dual@test.com`. Run `python manage.py shell < scripts/seed.py` to create them.
