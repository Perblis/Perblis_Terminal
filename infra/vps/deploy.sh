#!/usr/bin/env bash
# deploy.sh — build + roll the Terminal production stack on this VPS (D-027).
#
# Operates on the dedicated production checkout at /opt/terminal/repo (never
# the dirty dev worktree) and the secrets file /opt/terminal/.env. Idempotent:
# safe to re-run; every run converges to origin/$BRANCH.
set -euo pipefail

REPO_DIR="${REPO_DIR:-/opt/terminal/repo}"
ENV_FILE="${ENV_FILE:-/opt/terminal/.env}"
BRANCH="${BRANCH:-main}"
COMPOSE=(docker compose --project-directory "$REPO_DIR/infra/vps" -f "$REPO_DIR/infra/vps/docker-compose.prod.yml")

[ -f "$ENV_FILE" ] || { echo "deploy: missing $ENV_FILE — see infra/vps/.env.example" >&2; exit 1; }

echo "==> fetch + reset $REPO_DIR to origin/$BRANCH"
git -C "$REPO_DIR" fetch origin "$BRANCH"
git -C "$REPO_DIR" reset --hard "origin/$BRANCH"

echo "==> build images (api + worker share one)"
"${COMPOSE[@]}" build api worker portal

echo "==> ensure db is up"
"${COMPOSE[@]}" up -d db

echo "==> migrate + seed (advisory-locked, idempotent)"
"${COMPOSE[@]}" run --rm --no-deps api python manage.py deploy --noinput
"${COMPOSE[@]}" run --rm --no-deps api python manage.py seed_spec_templates

echo "==> roll api + worker + portal"
"${COMPOSE[@]}" up -d api worker portal

echo "==> install periodic tasks + backup dir"
install -m 0644 "$REPO_DIR/infra/vps/terminal.cron" /etc/cron.d/terminal
mkdir -p /var/backups/terminal

echo "==> loopback health check"
for _ in $(seq 1 12); do
  if curl -fsS http://127.0.0.1:8100/healthz >/dev/null 2>&1 && curl -fsS http://127.0.0.1:8101 >/dev/null 2>&1; then
    echo "deploy: OK — api on 127.0.0.1:8100, portal on 127.0.0.1:8101"
    exit 0
  fi
  sleep 5
done
echo "deploy: health check timed out — inspect with: ${COMPOSE[*]} ps" >&2
exit 1
