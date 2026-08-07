# Deploy — VPS production (D-027)

Production is self-hosted on the founder's VPS: the Django API + worker +
PostGIS and the Supplier Portal run as one Docker Compose project behind the
host nginx ingress. Media stays on Cloudflare R2; Paystack/Termii/Resend/Ably
stay SaaS. (History: D-012's Railway + Workers topology was superseded by
D-027 on 2026-08-07; the pre-cutover runbook is in git history.)

Everything here runs **on the VPS as root** unless noted.

## Prerequisites (once per host)

- Docker + the compose plugin, nginx + certbot, and `vps-publish` — already
  present (see `_governance/vps-vital-facts.md`).
- Infisical CLI authenticated; project `perblis-terminal` linked.
- DNS: `*.lab.perblis.com` wildcard already points at this host.

## 1. Secrets → `/opt/terminal/.env`

```bash
infisical export --path=<project-path> --env=prod --format=dotenv > /opt/terminal/.env
$EDITOR /opt/terminal/.env     # apply infra/vps/.env.example: POSTGRES_*,
                               # DATABASE_URL (host = db), ALLOWED_HOSTS,
                               # CORS_ALLOWED_ORIGINS, PAYMENT_RETURN_BASE_URL,
                               # API_BASE_URL
chmod 600 /opt/terminal/.env
```

Key generation when a value is missing from Infisical:

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(64))"                 # SECRET_KEY
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"  # FIELD_ENCRYPTION_KEY
```

## 2. First bring-up

```bash
git clone <canonical-remote> /opt/terminal/repo
/opt/terminal/repo/infra/vps/deploy.sh
```

`deploy.sh` fetches + hard-resets `/opt/terminal/repo` to `origin/main`,
builds the images (api + worker share `backend/Dockerfile`; portal builds from
`infra/vps/portal.Dockerfile`), runs `manage.py deploy --noinput` +
`seed_spec_templates`, rolls the services, installs `/etc/cron.d/terminal`,
and fails loudly unless `/healthz` + the portal answer on loopback.

Verify:

```bash
curl -s http://127.0.0.1:8100/healthz    # {"status":"ok"}
curl -s http://127.0.0.1:8100/readyz     # database ok; integrations may read not_configured
```

## 3. Publish (nginx + TLS)

```bash
vps-publish --name terminal-api --port 8100 --tier public --cert
vps-publish --name terminal     --port 8101 --tier public --cert
```

The API must be public (mobile app + Paystack webhook); the portal is public
(suppliers). `--cert` runs certbot against the existing wildcard DNS.

## 4. Data migration (one-time, from Railway)

```bash
pg_dump -Fc "<railway DATABASE_URL>" -f /tmp/terminal-railway.dump
docker cp /tmp/terminal-railway.dump terminal-db-1:/tmp/
docker compose --project-directory /opt/terminal/repo/infra/vps \
  -f /opt/terminal/repo/infra/vps/docker-compose.prod.yml exec -T db \
  pg_restore -U terminal -d terminal --clean --if-exists /tmp/terminal-railway.dump
# then verify row counts per table before cutover
```

Keep the Railway database as a read-only fallback until Phase-6 teardown.

## 5. Periodic tasks + backups

`/etc/cron.d/terminal` (installed by deploy.sh): hire sweeps every 5 min,
daily reconciliation + handover-photo purge + NDPR purge, weekly digest, and a
nightly `pg_dump` to `/var/backups/terminal` with 14-day retention. Output
lands in `/var/log/terminal-cron.log`.

## 6. App + integration cutover switches

- Mobile: `mobile/lib/api.ts` defaults point at the VPS API; publish via
  `eas update --branch preview` (JS-only — no rebuild). See
  `docs/runbooks/app-release.md`.
- Paystack dashboard webhook → `https://<api-host>/api/v1/payments/webhook`.
- Moving to product domains later: infra/vps/README.md §"Moving from lab to
  product domains".

## Troubleshooting

- **Container restart-looping on import errors** — `/opt/terminal/.env` is
  missing a value prod settings require; `docker compose … logs api` names it.
- **`relation … does not exist`** — deploy step didn't run migrations; re-run
  deploy.sh (the `deploy` command is advisory-locked and idempotent).
- **Admin pages 500 on static assets** — the image was built without a working
  `collectstatic`; rebuild (it fails the build loudly by design).
- **Portal up but API calls fail** — `API_BASE_URL` in `/opt/terminal/.env`
  must be the public API origin with the `/api/v1` suffix.
- **DB connection errors** — `DATABASE_URL` must use the `postgis://` scheme
  and the `db` service host, not `localhost`.
