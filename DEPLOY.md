# Deploy — Wave 0 production bring-up

This runbook stands up Terminal's production environment: the Django API +
worker + PostGIS on **Railway**, the Supplier Portal on **Cloudflare Workers**,
and media buckets on **Cloudflare R2**. It is the founder-executed half of
Wave 0's exit criterion (`/healthz` green in prod, portal loads on Workers).

Everything here needs your own cloud accounts and secrets — it is not run from
CI or a sandbox. Target fixed spend ≈ $10–15/mo; hard ceiling **$25/mo** (D-012).

## Prerequisites

- Railway account (Hobby plan) · Cloudflare account (Workers + R2)
- `railway` CLI and `wrangler` CLI authenticated locally
- A generated `SECRET_KEY`: `python -c "import secrets; print(secrets.token_urlsafe(64))"`
- A Fernet key: `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`

## 1. Railway — database, API, worker

Topology (TSD §1): **api** (gunicorn, 512 MB) · **worker** (django-tasks, 256 MB)
· **PostgreSQL 17 + PostGIS 3.5**.

1. Create a project; add the **PostGIS** plugin (Railway template `postgis-17`).
   It exposes `DATABASE_URL` — rewrite the scheme to `postgis://` for the GIS
   backend (set it explicitly in the service vars below).
2. Create the **api** service from this repo.
   - **Set Root Directory = `backend`** (Settings → Source). This is critical:
     it makes Railway build `backend/Dockerfile` (Python) instead of the repo
     root, which is a pnpm/Node workspace. Building from the root yields a Node
     image with no `python`, and the container dies at start with
     `/bin/bash: line 1: python: command not found`.
   - With the root set, `backend/railway.json` pins the **Dockerfile** builder,
     the start command (`gunicorn`), the pre-deploy command
     (`migrate` + `seed_superuser`), and the `/healthz` health check — so the
     api service needs no further build config.
3. Create the **worker** service: same repo, **Root Directory = `backend`**,
   builder = Dockerfile, and override the **start command** to
   `python manage.py db_worker`. (It inherits the idempotent pre-deploy from
   `railway.json` — harmless to run twice.)
4. Set service variables on **both** api and worker (values are yours):

   ```
   DJANGO_SETTINGS_MODULE=settings.prod
   DEBUG=0
   SECRET_KEY=<generated>
   DATABASE_URL=postgis://<user>:<pass>@<host>:<port>/<db>
   ALLOWED_HOSTS=<api-domain>
   CORS_ALLOWED_ORIGINS=https://<portal-domain>
   FIELD_ENCRYPTION_KEY=<fernet key>
   SENTRY_DSN=<optional>
   SENTRY_ENVIRONMENT=production
   # Integration keys — set as you provision each (absent => degraded, not crashed):
   BACHS_API_BASE=https://api.bachs.io/v1   # sandbox: https://sandbox-api.bachs.io/v1
   BACHS_SECRET_KEY= BACHS_WEBHOOK_SECRET=
   ABLY_API_KEY= TERMII_API_KEY= TERMII_SENDER_ID= RESEND_API_KEY= LOCATIONIQ_KEY=
   R2_ACCOUNT_ID= R2_ACCESS_KEY_ID= R2_SECRET= R2_PUBLIC_BUCKET= R2_PRIVATE_BUCKET= R2_PUBLIC_BASE_URL=
   ```

   See `backend/.env.example` for the exhaustive list. **Never commit secrets.**
5. Set a Railway **usage cap** to protect the budget.
6. Deploy. Confirm `GET https://<api-domain>/healthz` returns `{"status":"ok"}`
   and `/readyz` shows `database: ok` (integrations may be `not_configured`
   until their keys are set).

## 2. Cloudflare R2 — media buckets

1. Create two buckets: **public** (`terminal-public`) and **private**
   (`terminal-private`).
2. Create an R2 API token (Object Read & Write); put the credentials in the
   Railway api/worker vars (`R2_*`). The presign endpoint is implemented in
   Wave 2 — only the credentials are wired now.

## 3. Cloudflare Workers — Supplier Portal

Config: `portal/wrangler.toml` · Worker name **`terminal-portal`** (must match
the dashboard exactly).

### 3a. Workers Builds (recommended — Linux CI, fixes Windows OpenNext bundles)

[Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/) deploys
on every push to `main`. **Do not build on Windows** — OpenNext produces a
broken bundle (`middleware-manifest.json` dynamic require) when built locally on
Win32; Workers Builds runs on Ubuntu 24.04.

1. [Workers & Pages](https://dash.cloudflare.com/?to=/:account/workers-and-pages)
   → **terminal-portal** → **Settings** → **Builds** → **Connect**.
2. Authorize Cloudflare's GitHub app if prompted; select **`Perblis/Perblis_Terminal`**.
3. Use these build settings (monorepo — root is the repo, not `portal/`):

   | Setting | Value |
   | --- | --- |
   | **Production branch** | `main` |
   | **Root directory** | `/` (repo root — required for `packages/tokens` workspace) |
   | **Build command** | *(leave empty — pnpm install runs automatically via `packageManager`)* |
   | **Deploy command** | `pnpm --filter @terminal/portal run deploy` |
   | **Non-production deploy command** | `pnpm --filter @terminal/portal run deploy:preview` |

   *(After `portal:deploy` scripts land on `main`, you can shorten those to
   `pnpm portal:deploy` / `pnpm portal:deploy:preview`.)*

4. **Build variables** (Settings → Build → Variables and secrets):

   | Variable | Value |
   | --- | --- |
   | `PNPM_VERSION` | `10.33.0` |
   | `NODE_VERSION` | `22` |

5. **Runtime variables** are already in `wrangler.toml [vars]` (`API_BASE_URL`).
   Add `NEXT_PUBLIC_*` build vars here if the Next build needs them.
6. Push to `main` (or **Retry build** in the dashboard). Confirm
   https://terminal-portal.nwabueze.workers.dev/login loads.

   **Optional (after Git is connected):** Settings → Build → **Build watch paths**
   is a separate sub-section — not on the initial connect form. Defaults to
   include `*` (every push builds). For a monorepo you can later narrow it to
   `portal/*, packages/tokens/*, pnpm-lock.yaml` to skip unrelated commits.

Monitor builds via the Cloudflare dashboard or the **cloudflare-builds** MCP
(`workers_builds_list_builds`, `workers_builds_get_build_logs`).

### 3b. Manual deploy (Linux/macOS only)

```bash
pnpm install
pnpm portal:deploy   # opennextjs-cloudflare build && deploy
```

- Runtime API origin: `API_BASE_URL` in `wrangler.toml [vars]` (Railway api).
- **Avoid `pnpm portal:deploy` on Windows** — use Workers Builds or WSL instead.

## 4. Continuous deploy

Merge to `main` triggers:
- **Railway**: auto-deploy of api + worker; the pre-deploy command in
  `backend/railway.json` runs `migrate` (+ `seed_superuser`) before the new
  release goes live.
- **Portal**: Workers Builds (§3a) on pushes to `main`. PR CI remains
  `.github/workflows/portal.yml` (lint/test/e2e only).

## Exit check (Wave 0)

- [ ] `https://<api-domain>/healthz` returns green in production
- [ ] Portal hello-world loads on its Workers URL
- [ ] `accounts` migration `0001` applied in prod
- [ ] No secrets in git history
- [ ] Projected fixed spend ≤ $25/mo (≈ $10–15 target)

## Troubleshooting

- **`/bin/bash: line 1: python: command not found` at container start** — the
  service built the repo root (a pnpm/Node workspace) instead of the backend.
  Set the service **Root Directory = `backend`** so `backend/Dockerfile` and
  `backend/railway.json` are used. Applies to both the api and worker services.
- **`relation "users" does not exist` / app errors on first hit** — the
  pre-deploy migrate didn't run. Confirm `railway.json` is at the service root
  (i.e. Root Directory = `backend`) or set the pre-deploy command manually.
- **DB connection/SSL errors** — ensure `DATABASE_URL` uses the `postgis://`
  scheme (not `postgresql://`) so GeoDjango loads, and points at the Railway
  PostGIS plugin (session port), not a transaction pooler.
