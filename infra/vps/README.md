# infra/vps — self-hosted production (D-027)

Terminal's production stack runs on the founder's VPS as one Docker Compose
project. The host's nginx ingress (managed by `vps-publish`, see
`_governance/vps-vital-facts.md`) terminates TLS and proxies to loopback
ports — no container publishes a public port.

```
443  nginx (terminal-api.lab.perblis.com) ──▶ 127.0.0.1:8100  api     gunicorn
443  nginx (terminal.lab.perblis.com)     ──▶ 127.0.0.1:8101  portal  Next.js standalone
                                                │             worker  django-tasks db_worker
                                                └──────────── db      PostGIS 17-3.5 (volume: pgdata)
/etc/cron.d/terminal ── docker compose exec ──▶ sweeps · reconciliation · purges · digest · pg_dump
```

## Files

| File | Purpose |
|---|---|
| `docker-compose.prod.yml` | The 4-service stack; env from `/opt/terminal/.env` (absolute, so cron works from any cwd) |
| `portal.Dockerfile` | Portal image: pnpm workspace build → `next build` standalone → node:22-alpine runner |
| `deploy.sh` | Converge to `origin/main`: fetch, build, migrate+seed, roll services, install cron, health-check |
| `terminal.cron` | Periodic tasks (copied to `/etc/cron.d/terminal` by deploy.sh) |
| `.env.example` | The `/opt/terminal/.env` contract — compose-level values; backend keys per `backend/.env.example` |

## Layout on the host

- `/opt/terminal/repo` — dedicated clone tracking `main` (never deploy from the dev worktree)
- `/opt/terminal/.env` — secrets, root:root 0600, exported from Infisical prod
- `/var/backups/terminal/` — nightly `pg_dump` archives, 14-day retention
- `/var/log/terminal-cron.log` — periodic-task output

## Daily operation

```bash
/opt/terminal/repo/infra/vps/deploy.sh          # deploy latest main
docker compose --project-directory /opt/terminal/repo/infra/vps \
  -f /opt/terminal/repo/infra/vps/docker-compose.prod.yml ps
curl -s http://127.0.0.1:8100/healthz           # api liveness
curl -s http://127.0.0.1:8100/readyz            # db + integrations
```

## Moving from lab to product domains

1. `vps-publish --name <new> --port <8100|8101> --tier public --cert` for the new names.
2. `/opt/terminal/.env`: `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`,
   `PAYMENT_RETURN_BASE_URL`, `API_BASE_URL` → product domains.
3. `deploy.sh` (rolls services with the new env).
4. Paystack dashboard webhook → the new API host; publish an app OTA with the
   new `EXPO_PUBLIC_API_BASE_URL` default.
