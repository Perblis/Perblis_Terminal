# Terminal

> **The heavy asset leasing marketplace for Africa.**
> Connect owners of heavy equipment, vehicles, warehouses, terminals, and container yards with renters — all through a single API.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Variables](#environment-variables)
  - [Database Setup](#database-setup)
  - [Running the Development Server](#running-the-development-server)
- [API Reference](#api-reference)
  - [Authentication](#authentication)
  - [Users](#users)
  - [Listings](#listings)
  - [Search](#search)
  - [Bookings](#bookings)
  - [Messaging](#messaging)
- [Seed Data](#seed-data)
- [Testing](#testing)
- [Linting](#linting)
- [Admin Panel](#admin-panel)
- [Deployment (Railway)](#deployment-railway)
  - [Railway Configuration](#railway-configuration)
  - [Environment Variables (Production)](#environment-variables-production)
  - [Post-Deploy Steps](#post-deploy-steps)
- [Simulation Placeholders](#simulation-placeholders)
- [Contributing](#contributing)

---

## Overview

Terminal is a backend API for a heavy asset leasing marketplace. The platform facilitates the rental of:

| Resource Type | Examples |
|---|---|
| **Equipment** | Cranes, excavators, bulldozers, forklifts |
| **Vehicles** | Flatbed trucks, tippers, low-loaders |
| **Warehouses** | Bonded warehouses, cold storage facilities |
| **Terminals** | Container depots, container yards |
| **Facilities** | Equipment yards, staging areas |

### Core Flow

```
Browse / Search on Map → View Listing → Request Booking → Owner Accepts → Chat → Pay (simulated)
```

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                        Django REST API                        │
├──────────┬───────────┬──────────┬────────────┬───────────────┤
│ accounts │  listings │  search  │  bookings  │   messaging   │
│  (auth)  │  (CRUD)   │  (geo)   │ (lifecycle)│   (threads)   │
└────┬─────┴─────┬─────┴────┬─────┴─────┬──────┴───────┬───────┘
     │           │          │           │              │
     ▼           ▼          ▼           ▼              ▼
┌─────────────────────────────────────────────────────────────┐
│              PostgreSQL 16 + PostGIS 3                       │
└─────────────────────────────────────────────────────────────┘
     │                                              │
     ▼                                              ▼
┌──────────────────┐                    ┌───────────────────┐
│  Cloudflare R2   │                    │       Ably        │
│  (file storage)  │                    │  (realtime msgs)  │
└──────────────────┘                    └───────────────────┘
```

The **`owner-web/`** directory is a Next.js 16 owner portal (separate `npm` app) that consumes the same API. The mobile renter/owner app is developed in a separate repository (see root `AGENTS.md`).

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | Django 5.x + Django REST Framework |
| **Database** | PostgreSQL 16 + PostGIS 3 (GeoDjango) |
| **Auth** | JWT via `djangorestframework-simplejwt` |
| **Geospatial** | PostGIS, GDAL, GEOS, PROJ |
| **File Storage** | Cloudflare R2 (S3-compatible) in production, local filesystem in dev |
| **Realtime** | Ably (async message delivery) |
| **Background Tasks** | Django Q2 (ORM-backed) |
| **Admin** | Django Unfold (modern admin theme) |
| **API Docs** | drf-spectacular (OpenAPI 3 / Swagger UI) |
| **Error Tracking** | Sentry |
| **Deployment** | Railway (Nixpacks) |
| **Linting** | Ruff |
| **Owner portal** | Next.js 16 (`owner-web/`) |

---

## Project Structure

```
terminal/
├── owner-web/              # Next.js owner portal (separate npm package)
│   └── src/                # App Router, API routes, UI
├── config/                 # Django project configuration
│   ├── settings/
│   │   ├── base.py         # Shared settings
│   │   ├── development.py  # Dev-specific (DEBUG, local DB, console email)
│   │   └── production.py   # Production (Sentry, S3 storage, strict security)
│   ├── urls.py             # Root URL configuration
│   ├── wsgi.py
│   └── asgi.py
├── accounts/               # User management, authentication, KYC
│   ├── models.py           # User, OTPCode, UserDocument
│   ├── serializers.py      # JWT, registration, profile serializers
│   ├── services.py         # OTP, email, document processing
│   ├── views/              # Auth views, user views
│   └── urls/               # Auth URLs, user URLs
├── listings/               # Asset listings CRUD
│   ├── models.py           # Listing, ListingMedia, ListingReport
│   ├── serializers.py      # Listing create/update/detail serializers
│   ├── views.py            # List, create, update, media upload, report
│   └── urls.py
├── search/                 # Geospatial proximity search
│   ├── serializers.py      # Map search query/result serializers
│   ├── views.py            # Proximity search with PostGIS
│   └── urls.py
├── bookings/               # Booking lifecycle management
│   ├── models.py           # Booking, BookingStatus, PaymentStatus
│   ├── serializers.py      # Create, detail, action serializers
│   ├── views.py            # CRUD + accept/decline/cancel/pay
│   ├── signals.py          # Listing availability sync on status change
│   └── urls.py
├── messaging/              # In-context chat (threads + messages)
│   ├── models.py           # Thread, Message
│   ├── services.py         # Thread creation, Ably publishing, token gen
│   ├── serializers.py      # Thread list, message, inquiry serializers
│   ├── views.py            # Thread CRUD, send message, Ably token
│   └── urls.py
├── core/                   # Shared utilities
│   ├── models.py           # BaseModel (UUID + timestamps)
│   ├── exceptions.py       # Custom DRF exception handler
│   ├── pagination.py       # Standard pagination
│   └── permissions.py      # Role-based permissions
├── scripts/
│   └── seed.py             # Seed data for internal testing
├── requirements/
│   ├── base.txt            # Core dependencies
│   ├── development.txt     # Dev tools (debug toolbar)
│   └── production.txt      # Production (gunicorn)
├── Procfile                # Railway process definitions
├── railway.toml            # Railway deployment config
├── nixpacks.toml           # System dependencies for Nixpacks
├── ruff.toml               # Linter configuration
└── manage.py
```

---

## Getting Started

### Prerequisites

- **Python 3.12+**
- **PostgreSQL 16** with **PostGIS 3** extension
- **System GIS libraries**: GDAL, GEOS, PROJ

#### Install system dependencies (Ubuntu/Debian)

```bash
sudo apt-get update
sudo apt-get install -y \
  postgresql postgresql-contrib \
  postgis postgresql-16-postgis-3 \
  gdal-bin libgdal-dev libgeos-dev libproj-dev \
  python3.12-venv
```

---

### Installation

```bash
# Clone the repository
git clone https://github.com/Nwa-dev/terminalv2.git
cd terminalv2

# Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements/development.txt
```

---

### Environment Variables

Copy the example environment file and configure:

```bash
cp .env.example .env
```

**`.env` file contents:**

| Variable | Description | Default |
|---|---|---|
| `SECRET_KEY` | Django secret key (50+ chars) | *(required)* |
| `DEBUG` | Enable debug mode | `True` |
| `ALLOWED_HOSTS` | Comma-separated hostnames | `localhost,127.0.0.1` |
| `CORS_ALLOW_ALL_ORIGINS` | Allow all CORS origins | `True` |
| `DB_NAME` | PostgreSQL database name | `terminal_dev` |
| `DB_USER` | Database user | `postgres` |
| `DB_PASSWORD` | Database password | `postgres` |
| `DB_HOST` | Database host | `localhost` |
| `DB_PORT` | Database port | `5432` |
| `R2_ACCESS_KEY_ID` | Cloudflare R2 access key | *(empty = local filesystem media)* |
| `R2_SECRET_ACCESS_KEY` | Cloudflare R2 secret | *(empty = local filesystem media)* |
| `R2_BUCKET_NAME` | R2 bucket (development settings) | `terminal-uploads` |
| `R2_ENDPOINT_URL` | R2 S3 API endpoint (dev) | *(empty)* |
| `R2_CUSTOM_DOMAIN` | Public hostname for media URLs (dev) | *(empty)* |
| `ABLY_API_KEY` | Ably realtime API key | *(empty = console fallback)* |
| `MAPBOX_ACCESS_TOKEN` | Mapbox token | *(empty)* |
| `SENTRY_DSN` | Sentry DSN for error tracking | *(empty = disabled)* |

---

### Database Setup

```bash
# Start PostgreSQL
sudo service postgresql start

# Create database and enable PostGIS
sudo -u postgres psql -c "CREATE DATABASE terminal_dev;"
sudo -u postgres psql -d terminal_dev -c "CREATE EXTENSION IF NOT EXISTS postgis;"

# Optionally set the postgres password (if different from default)
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'postgres';"

# Run migrations
python manage.py migrate

# Create a superuser for the admin panel
python manage.py createsuperuser --email admin@terminal.app
```

---

### Running the Development Server

```bash
# Activate virtual environment
source venv/bin/activate

# Start the server
python manage.py runserver 0.0.0.0:8000
```

The API will be available at:

| Endpoint | Description |
|---|---|
| `http://localhost:8000/health/` | Health check |
| `http://localhost:8000/api/docs/` | Swagger UI (interactive API docs) |
| `http://localhost:8000/api/schema/` | OpenAPI 3 schema (JSON) |
| `http://localhost:8000/admin/` | Django admin panel |

#### Optional: Owner web (Next.js)

```bash
cd owner-web
cp .env.example .env.local   # set NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
npm install && npm run dev
```

See `owner-web/README.md` for more detail.

#### Optional: Background task worker

```bash
python manage.py qcluster
```

---

## API Reference

All endpoints are prefixed with `/api/v1/`. Authentication uses **Bearer JWT tokens** in the `Authorization` header.

### Authentication

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `POST` | `/api/v1/auth/register/` | Register new user | No |
| `POST` | `/api/v1/auth/login/` | Login (returns JWT tokens) | No |
| `POST` | `/api/v1/auth/token/refresh/` | Refresh access token | No |
| `POST` | `/api/v1/auth/logout/` | Logout (blacklist token) | Yes |
| `POST` | `/api/v1/auth/verify-otp/` | Verify phone OTP | Yes |
| `POST` | `/api/v1/auth/resend-otp/` | Resend phone OTP | Yes |
| `POST` | `/api/v1/auth/password/reset/` | Request password reset | No |
| `POST` | `/api/v1/auth/password/reset/confirm/` | Confirm password reset | No |

### Users

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `GET` | `/api/v1/users/me/` | Get current user profile (includes `unread_messages`) | Yes |
| `PUT/PATCH` | `/api/v1/users/me/` | Update profile | Yes |
| `PATCH` | `/api/v1/users/me/role/` | Update role (owner/renter) | Yes |
| `POST` | `/api/v1/users/me/documents/` | Upload KYC document | Yes |
| `GET` | `/api/v1/users/{id}/` | Public user profile | No |

### Listings

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `GET` | `/api/v1/listings/` | List the authenticated owner's listings (paginated) | Yes |
| `POST` | `/api/v1/listings/` | Create a new listing | Yes (owner) |
| `GET` | `/api/v1/listings/{id}/` | Get listing detail (increments view_count) | No |
| `PUT/PATCH` | `/api/v1/listings/{id}/` | Update listing | Yes (owner) |
| `PATCH` | `/api/v1/listings/{id}/status/` | Change listing status | Yes (owner) |
| `POST` | `/api/v1/listings/{id}/media/` | Upload listing photo | Yes (owner) |
| `POST` | `/api/v1/listings/{id}/report/` | Report a listing | Yes |

### Search

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `GET` | `/api/v1/search/map/` | Proximity search with filters | Yes |

**Query parameters:**

| Param | Type | Description |
|---|---|---|
| `lat` | float | Latitude (required) |
| `lng` | float | Longitude (required) |
| `radius` | int | Search radius in km (default: 50) |
| `resource_type` | string | Filter by type: `equipment`, `vehicle`, `warehouse`, `terminal`, `facility` |
| `min_price` | decimal | Minimum daily price |
| `max_price` | decimal | Maximum daily price |

### Bookings

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `GET` | `/api/v1/bookings/` | List bookings (`?role=renter\|owner\|both`, `?status=...`) | Yes |
| `POST` | `/api/v1/bookings/` | Create booking request | Yes (renter) |
| `GET` | `/api/v1/bookings/{id}/` | Booking detail (includes `thread_id`) | Yes (participant) |
| `PATCH` | `/api/v1/bookings/{id}/accept/` | Accept booking | Yes (owner) |
| `PATCH` | `/api/v1/bookings/{id}/decline/` | Decline booking | Yes (owner) |
| `PATCH` | `/api/v1/bookings/{id}/cancel/` | Cancel booking | Yes (either party) |
| `PATCH` | `/api/v1/bookings/{id}/pay/` | Mark as paid (simulated) | Yes (either party) |

**Booking lifecycle:**

```
pending → confirmed → simulated_paid
pending → declined
pending/confirmed → cancelled
```

**Signals:**
- When a booking is **confirmed**, the listing's `is_available` is set to `False`
- When a booking is **cancelled/declined/completed** and no other active bookings exist, `is_available` returns to `True`

### Messaging

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `GET` | `/api/v1/threads/` | List user's conversation threads | Yes |
| `POST` | `/api/v1/threads/` | Start inquiry thread (pre-booking) | Yes |
| `GET` | `/api/v1/threads/{id}/` | Thread detail + messages (marks as read) | Yes (participant) |
| `POST` | `/api/v1/threads/{id}/messages/` | Send a message | Yes (participant) |
| `POST` | `/api/v1/threads/token/` | Get Ably realtime auth token | Yes |

**Thread types:**
- **Booking thread** — auto-created when a booking request is made
- **Inquiry thread** — created manually when a renter messages from a listing page

---

## Seed Data

Populate the database with test data for development and internal testing:

```bash
python manage.py shell < scripts/seed.py
```

This creates:

| Type | Count | Details |
|---|---|---|
| **Owners** | 2 | `owner1@test.com`, `owner2@test.com` |
| **Renters** | 2 | `renter1@test.com`, `renter2@test.com` |
| **Dual user** | 1 | `dual@test.com` (both owner + renter) |
| **Listings** | 10 | Across all 5 resource types, located in Lagos |

**All test passwords:** `test1234!`

---

## Testing

The project uses **pytest** with `pytest-django` (see `pytest.ini`). Prefer `pytest` over `python manage.py test`.

```bash
# Full suite
pytest

# One app
pytest listings/

# One test node id
pytest listings/tests/test_views.py::TestListingListCreate::test_owner_gets_own_listings_only -q
```

**Coverage** includes tests across apps for:
- Model creation and validation
- API endpoint CRUD operations
- Permission and access control
- Business logic (date conflicts, financial calculations)
- Cross-module integration (booking → thread auto-creation)
- Signal-driven state changes (booking status → listing availability)
- Error handling and edge cases

---

## Linting

The project uses **Ruff** for fast Python linting:

```bash
# Run linter
ruff check .

# Auto-fix fixable issues
ruff check . --fix

# Format code
ruff format .
```

Configuration is in `ruff.toml`. Django settings star-imports and seed script ordering are suppressed intentionally.

---

## Admin Panel

The admin panel uses **Django Unfold** for a modern, responsive UI.

**Access:** `http://localhost:8000/admin/`

**Features:**
- **Users** — manage accounts, view verification status
- **Listings** — view all listings with filters, manage status
- **Reports** — review reported listings
- **Bookings** — view booking lifecycle, bulk cancel action
- **Threads** — view conversation threads with inline messages

---

## Deployment (Railway)

### Railway Configuration

The project includes three deployment files:

| File | Purpose |
|---|---|
| `Procfile` | Defines `web` (gunicorn) and `qcluster` (background tasks) processes |
| `railway.toml` | Railway-specific: start command, health check, restart policy |
| `nixpacks.toml` | System packages (GDAL, GEOS, PROJ) + build steps |

### Environment Variables (Production)

Set these in the Railway dashboard:

```env
# Django
DJANGO_SETTINGS_MODULE=config.settings.production
SECRET_KEY=<generate-50-char-random-string>
DEBUG=False
ALLOWED_HOSTS=<your-api>.railway.app

# CORS: list every browser origin that calls the API (comma-separated).
# OWNER_WEB_URL is appended automatically when set (e.g. your Next.js URL).
CORS_ALLOWED_ORIGINS=https://your-owner-web.up.railway.app
OWNER_WEB_URL=https://your-owner-web.up.railway.app

# Database (PostgreSQL + PostGIS — use Supabase or Railway Postgres)
DB_NAME=<database_name>
DB_USER=<database_user>
DB_PASSWORD=<database_password>
DB_HOST=<database_host>
DB_PORT=5432

# Cloudflare R2 (production settings expect these names — see config/settings/production.py)
R2_ACCESS_KEY_ID=<from-cloudflare>
R2_SECRET_ACCESS_KEY=<from-cloudflare>
R2_BUCKET=terminal-media
R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
R2_PUBLIC_URL=https://pub-<id>.r2.dev

# Ably (realtime messaging)
ABLY_API_KEY=<from-ably-dashboard>

# Mapbox (geocoding)
MAPBOX_ACCESS_TOKEN=<from-mapbox>

# Sentry (error tracking)
SENTRY_DSN=<from-sentry>
```

### Deployment Steps

1. **Connect GitHub repo** to Railway
2. Railway auto-detects `nixpacks.toml` and builds the project
3. On deploy, the start command runs migrations then starts gunicorn:
   ```
   python manage.py migrate && gunicorn config.wsgi:application --bind 0.0.0.0:$PORT --workers 2
   ```
4. Railway health-checks `/health/` automatically

### Post-Deploy Steps

**Automatic admin bootstrap (recommended on Railway):** set these variables on the API service. Every deploy runs `ensure_superuser` after `migrate` (see `railway.toml`); if the variables are unset, the step is skipped.

```env
SEED_SUPERUSER_EMAIL=admin@yourdomain.com
SEED_SUPERUSER_PASSWORD=<strong-unique-password>
# Optional (defaults shown):
# SEED_SUPERUSER_PHONE=+2348000000999
# SEED_SUPERUSER_FIRST_NAME=Admin
# SEED_SUPERUSER_LAST_NAME=User
```

Log in at `https://<your-api>/admin/` with that email and password. Re-deploying updates the password if you change `SEED_SUPERUSER_PASSWORD`.

```bash
# Verify the deployment
curl https://<your-app>.railway.app/health/
# → {"status": "ok", "service": "Terminal API"}

# Verify API docs
open https://<your-app>.railway.app/api/docs/

# Seed production data (optional)
railway run python manage.py shell < scripts/seed.py

# Create admin superuser (manual alternative if you do not use SEED_SUPERUSER_*)
railway run python manage.py createsuperuser --email admin@terminal.app
```

---

## Simulation Placeholders

The MVP uses simulated implementations for features that require third-party integration in production:

| Feature | Simulation | Console Marker | Future Integration |
|---|---|---|---|
| Phone OTP | Printed to console | `[DEV OTP]` | Termii / Africa's Talking SMS |
| KYC Verification | Auto-approved on upload | `[DEV KYC]` | Smile Identity / Dojah |
| Payment | "Mark as paid" button | `[DEV PAYMENT]` | Paystack / Flutterwave |
| Realtime Messaging | Falls back to console if no Ably key | `[DEV ABLY]` | Ably (already integrated) |

---

## Contributing

1. Create a feature branch from `main`
2. Make your changes
3. Ensure `ruff check .` passes with no errors
4. Ensure `pytest` passes
5. Ensure `python manage.py check` reports 0 issues
6. Submit a pull request

### Key Conventions

- **User model** uses `email` as `USERNAME_FIELD` (not username)
- **All models** inherit from `core.models.BaseModel` (UUID primary key + timestamps)
- **API responses** use `{"success": true/false, "data": {...}}` format
- **Settings** are split into `base.py`, `development.py`, `production.py`
- **Geospatial** fields use `Point(longitude, latitude)` (note: longitude first!)
- **Django Q2** for background tasks (ORM-backed, no Redis needed)

---

<p align="center">
  <strong>Terminal</strong> — Heavy Asset Leasing Platform<br>
  Built with Django + PostGIS + Ably
</p>
