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
2. Create the **api** service from this repo, root `backend/` (Dockerfile build).
   - Start command: `gunicorn wsgi:application --bind 0.0.0.0:$PORT --workers 3`
   - Release command: `python manage.py migrate --noinput` (Procfile `release`).
   - Health check path: `/healthz`.
3. Create the **worker** service from the same image.
   - Start command: `python manage.py db_worker`.
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
   PAYSTACK_SECRET_KEY= PAYSTACK_PUBLIC_KEY= PAYSTACK_WEBHOOK_SECRET=
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

From `portal/` (config in `portal/wrangler.toml`):

```bash
pnpm install
pnpm --filter @terminal/portal deploy   # opennextjs-cloudflare build && deploy
```

- Set `NEXT_PUBLIC_API_BASE_URL` (and any portal vars) in the Cloudflare
  dashboard or `wrangler.toml [vars]`, pointing at the Railway api domain.
- Confirm the deployed Worker URL loads the hello-world page.

## 4. Continuous deploy

Merge to `main` triggers:
- **Railway**: auto-deploy of api + worker; the `release` phase runs `migrate`.
- **Portal**: add a GitHub Action step (or `wrangler deploy`) on `main` for
  `portal/**`. (CI for PRs is `.github/workflows/portal.yml`.)

## Exit check (Wave 0)

- [ ] `https://<api-domain>/healthz` returns green in production
- [ ] Portal hello-world loads on its Workers URL
- [ ] `accounts` migration `0001` applied in prod
- [ ] No secrets in git history
- [ ] Projected fixed spend ≤ $25/mo (≈ $10–15 target)
