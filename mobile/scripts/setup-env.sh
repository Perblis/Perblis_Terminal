#!/usr/bin/env bash
# setup-env.sh — write mobile/.env.local for local development, sourced from
# Infisical (path /mobile) with the committed defaults as fallback.
#
# READ THIS BEFORE TRUSTING IT TO FIX A DEVICE
# --------------------------------------------
# `.env.local` is gitignored (root .gitignore `.env.*`, mobile/.gitignore
# `.env*.local`). EAS Build uploads the project via git and the OTA workflow
# checks out git — NEITHER SEES THIS FILE. Every EAS build and every
# `eas update` bundle therefore ships the *committed defaults* in
# mobile/lib/api.ts. This script configures your local Metro/dev-client only.
# To change what ships to devices, change lib/api.ts and merge it.
#
# `EXPO_PUBLIC_*` values are inlined verbatim into the JS bundle and are
# readable by anyone who unzips the APK. They are configuration, not secrets.
# This script refuses to write a secret-looking name into that namespace.
# Real secrets (EXPO_TOKEN for EAS) stay in Infisical and are injected per
# command — never into a dotenv file. See _governance/secrets-policy.md.
#
# Usage:
#   ./scripts/setup-env.sh                    # prod hosts -> mobile/.env.local
#   ./scripts/setup-env.sh --target local     # local backend over your LAN IP
#   ./scripts/setup-env.sh --check            # audit only, write nothing
#   ./scripts/setup-env.sh --dry-run          # print the file, write nothing
#   ./scripts/setup-env.sh --seed             # push defaults into Infisical /mobile
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOBILE_DIR="$(dirname "$SCRIPT_DIR")"
REPO_ROOT="$(dirname "$MOBILE_DIR")"
ENV_FILE="$MOBILE_DIR/.env.local"
INFISICAL_PATH="/mobile"

# Committed fallbacks — MUST stay identical to the defaults in
# mobile/lib/api.ts, or local dev silently diverges from what ships.
PROD_API_URL="https://terminal-api.lab.perblis.com"
PROD_PORTAL_URL="https://terminal.lab.perblis.com"

TARGET="prod"
INFISICAL_ENV=""
API_URL_OVERRIDE=""
DRY_RUN=0
CHECK_ONLY=0
SEED=0

die() { echo "setup-env: $*" >&2; exit 1; }
ok()   { printf '  \033[32mOK\033[0m    %s\n' "$*"; }
warn() { printf '  \033[33mWARN\033[0m  %s\n' "$*"; }
bad()  { printf '  \033[31mFAIL\033[0m  %s\n' "$*"; }

usage() {
  sed -n '2,26p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
  cat <<'EOF'

Options:
  --target prod|local   Which backend to point at (default: prod).
                        `local` uses http://<your-LAN-IP>:8000 so a physical
                        device on the same Wi-Fi can reach your dev server;
                        localhost would resolve to the phone itself.
  --api-url URL         Explicit API base URL; overrides --target detection.
  --infisical-env ENV   Infisical environment to read (default: prod for
                        --target prod, dev for --target local).
  --check               Audit config drift and host reachability. No writes.
  --dry-run             Print the file that would be written. No writes.
  --seed                Write the non-secret defaults into Infisical
                        <path /mobile> for the chosen environment. Prompts.
  -h, --help            This text.
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    --target)        TARGET="${2:-}"; shift 2 ;;
    --api-url)       API_URL_OVERRIDE="${2:-}"; shift 2 ;;
    --infisical-env) INFISICAL_ENV="${2:-}"; shift 2 ;;
    --check)         CHECK_ONLY=1; shift ;;
    --dry-run)       DRY_RUN=1; shift ;;
    --seed)          SEED=1; shift ;;
    -h|--help)       usage; exit 0 ;;
    *)               die "unknown argument: $1 (try --help)" ;;
  esac
done

case "$TARGET" in
  prod)  : ;;
  local) : ;;
  *)     die "--target must be 'prod' or 'local' (got '$TARGET')" ;;
esac
[ -n "$INFISICAL_ENV" ] || { [ "$TARGET" = "prod" ] && INFISICAL_ENV=prod || INFISICAL_ENV=dev; }

# ---------------------------------------------------------------- preflight
echo "==> preflight"
[ -f "$MOBILE_DIR/app.json" ] || die "not a mobile checkout: $MOBILE_DIR/app.json missing"
ok "mobile checkout at $MOBILE_DIR"

HAVE_INFISICAL=0
if command -v infisical >/dev/null 2>&1 && [ -f "$REPO_ROOT/.infisical.json" ]; then
  HAVE_INFISICAL=1
  ok "infisical CLI present, repo linked"
else
  warn "infisical unavailable or repo unlinked — using committed defaults"
fi

# `.env.local` must never become a tracked file.
if git -C "$REPO_ROOT" check-ignore -q "$ENV_FILE" 2>/dev/null; then
  ok ".env.local is gitignored"
else
  die ".env.local is NOT gitignored — refusing to write. Fix .gitignore first."
fi

# ------------------------------------------------------- resolve the values
# Precedence: --api-url > Infisical /mobile > committed default.
declare -A VALUES
fetch_infisical() {
  [ "$HAVE_INFISICAL" -eq 1 ] || return 0
  local dump
  dump="$(cd "$REPO_ROOT" && infisical export --env="$INFISICAL_ENV" --path="$INFISICAL_PATH" --format=dotenv 2>/dev/null || true)"
  [ -n "$dump" ] || return 0
  while IFS= read -r line; do
    case "$line" in
      [A-Za-z_]*=*)
        local k="${line%%=*}" v="${line#*=}"
        v="${v%\"}"; v="${v#\"}"; v="${v%\'}"; v="${v#\'}"
        VALUES["$k"]="$v"
        ;;
    esac
  done <<<"$dump"
}
fetch_infisical
INFISICAL_KEYS="${!VALUES[*]}"

detect_lan_ip() {
  local ip
  ip="$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="src") print $(i+1)}' | head -1)"
  [ -n "$ip" ] || ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
  printf '%s' "${ip:-127.0.0.1}"
}

if [ "$TARGET" = "prod" ]; then
  API_URL="${VALUES[EXPO_PUBLIC_API_BASE_URL]:-$PROD_API_URL}"
  PORTAL_URL="${VALUES[EXPO_PUBLIC_PORTAL_URL]:-$PROD_PORTAL_URL}"
else
  API_URL="http://$(detect_lan_ip):8000"
  PORTAL_URL="http://$(detect_lan_ip):3000"
fi
[ -n "$API_URL_OVERRIDE" ] && API_URL="$API_URL_OVERRIDE"
SENTRY_DSN="${VALUES[EXPO_PUBLIC_SENTRY_DSN]:-}"

# --------------------------------------------------- EXPO_PUBLIC_ guardrail
# Anything under EXPO_PUBLIC_ ends up in the shipped bundle. A Sentry DSN is
# designed to be client-visible; a signing key or API secret is not.
assert_publishable() {
  local name="$1"
  case "$name" in
    EXPO_PUBLIC_SENTRY_DSN) return 0 ;;
    *SECRET*|*PASSWORD*|*PRIVATE*|*_TOKEN|*API_KEY*)
      die "refusing to write '$name' — EXPO_PUBLIC_* is inlined into the APK bundle and is readable by anyone. Keep it in Infisical and inject it per command instead."
      ;;
  esac
}
for k in $INFISICAL_KEYS; do
  case "$k" in EXPO_PUBLIC_*) assert_publishable "$k" ;; esac
done

# ------------------------------------------------------------------- checks
verify_host() {
  local label="$1" url="$2" code
  case "$url" in
    https://*|http://*) : ;;
    *) bad "$label: '$url' is not an absolute URL"; return 1 ;;
  esac
  code="$(curl -s -o /dev/null -m 10 -w '%{http_code}' "$url" 2>/dev/null || echo 000)"
  case "$code" in
    000) bad "$label unreachable ($url)"; return 1 ;;
    404|5*) bad "$label returned HTTP $code ($url)"; return 1 ;;
    *) ok "$label HTTP $code ($url)"; return 0 ;;
  esac
}

echo "==> resolved config (target=$TARGET, infisical env=$INFISICAL_ENV)"
if [ -n "$INFISICAL_KEYS" ]; then
  ok "Infisical $INFISICAL_PATH provided: $INFISICAL_KEYS"
else
  warn "Infisical $INFISICAL_PATH is empty for env '$INFISICAL_ENV' — using committed defaults (run with --seed to populate it)"
fi
echo "  EXPO_PUBLIC_API_BASE_URL = $API_URL"
echo "  EXPO_PUBLIC_PORTAL_URL   = $PORTAL_URL"
echo "  EXPO_PUBLIC_SENTRY_DSN   = $([ -n "$SENTRY_DSN" ] && echo '<set>' || echo '<unset — Sentry inert>')"

echo "==> drift check against the committed defaults (what actually ships)"
SHIPPED_API="$(grep -oE '"https?://[^"]+"' "$MOBILE_DIR/lib/api.ts" | sed -n '1p' | tr -d '"')"
SHIPPED_PORTAL="$(grep -oE '"https?://[^"]+"' "$MOBILE_DIR/lib/api.ts" | sed -n '2p' | tr -d '"')"
echo "  lib/api.ts API default    = $SHIPPED_API"
echo "  lib/api.ts portal default = $SHIPPED_PORTAL"
case "$SHIPPED_API" in
  *railway.app*|*workers.dev*)
    bad "lib/api.ts still points at a decommissioned host — EVERY EAS build and OTA bundle ships this. Fix it in git; .env.local cannot save you." ;;
  "$PROD_API_URL") ok "lib/api.ts matches the expected production API" ;;
  *) warn "lib/api.ts default ($SHIPPED_API) differs from this script's PROD_API_URL ($PROD_API_URL) — one of them is stale" ;;
esac

echo "==> host reachability"
verify_host "API"    "${API_URL%/}/healthz" || true
verify_host "Portal" "$PORTAL_URL"          || true

if [ "$HAVE_INFISICAL" -eq 1 ]; then
  if printf '%s\n' $INFISICAL_KEYS | grep -qx "EXPO_TOKEN"; then
    ok "EXPO_TOKEN present in Infisical $INFISICAL_PATH ($INFISICAL_ENV) — run EAS as:"
    echo "        infisical run --env=$INFISICAL_ENV --path=$INFISICAL_PATH -- pnpm exec eas build --profile preview --platform android"
  else
    warn "EXPO_TOKEN absent from Infisical $INFISICAL_PATH ($INFISICAL_ENV) — EAS builds/OTA rely on an interactive login or the GitHub EXPO_TOKEN secret only"
  fi
fi

# -------------------------------------------------------------------- seed
if [ "$SEED" -eq 1 ]; then
  [ "$HAVE_INFISICAL" -eq 1 ] || die "--seed needs the infisical CLI and a linked repo"
  echo "==> seed Infisical $INFISICAL_PATH ($INFISICAL_ENV)"
  echo "    EXPO_PUBLIC_API_BASE_URL = $PROD_API_URL"
  echo "    EXPO_PUBLIC_PORTAL_URL   = $PROD_PORTAL_URL"
  echo "    (non-secret, bundle-visible config only — no keys are written)"
  read -r -p "    proceed? [y/N] " reply
  case "$reply" in
    [yY]*)
      (cd "$REPO_ROOT" && infisical secrets set "EXPO_PUBLIC_API_BASE_URL=$PROD_API_URL" --env="$INFISICAL_ENV" --path="$INFISICAL_PATH" >/dev/null)
      (cd "$REPO_ROOT" && infisical secrets set "EXPO_PUBLIC_PORTAL_URL=$PROD_PORTAL_URL" --env="$INFISICAL_ENV" --path="$INFISICAL_PATH" >/dev/null)
      ok "seeded (values not echoed back)"
      ;;
    *) warn "skipped" ;;
  esac
fi

[ "$CHECK_ONLY" -eq 1 ] && { echo "==> --check: nothing written"; exit 0; }

# ------------------------------------------------------------------- write
RENDERED="$(cat <<EOF
# Generated by mobile/scripts/setup-env.sh — target=$TARGET, infisical env=$INFISICAL_ENV
# LOCAL DEVELOPMENT ONLY. This file is gitignored, so EAS builds and the OTA
# workflow never see it; they ship the defaults in mobile/lib/api.ts.
# Expo precedence: .env.<mode>.local > .env.local > .env.<mode> > .env
EXPO_PUBLIC_API_BASE_URL=$API_URL
EXPO_PUBLIC_PORTAL_URL=$PORTAL_URL
EOF
)"
[ -n "$SENTRY_DSN" ] && RENDERED="$RENDERED
EXPO_PUBLIC_SENTRY_DSN=$SENTRY_DSN"

if [ "$DRY_RUN" -eq 1 ]; then
  echo "==> --dry-run: would write $ENV_FILE"
  printf '%s\n' "$RENDERED" | sed 's/^/    /'
  exit 0
fi

echo "==> write $ENV_FILE"
if [ -f "$ENV_FILE" ]; then
  BACKUP="$ENV_FILE.bak"
  cp "$ENV_FILE" "$BACKUP"
  ok "backed up previous file to $(basename "$BACKUP")"
fi
printf '%s\n' "$RENDERED" > "$ENV_FILE"
chmod 600 "$ENV_FILE"
ok "wrote $(grep -c '^EXPO_PUBLIC_' "$ENV_FILE") variables"

echo "==> verify"
git -C "$REPO_ROOT" check-ignore -q "$ENV_FILE" && ok "still gitignored"
grep -q '^EXPO_PUBLIC_API_BASE_URL=' "$ENV_FILE" && ok "API base URL present"
echo
echo "Done. Restart Metro with a cleared cache so the new values are inlined:"
echo "    pnpm --filter @terminal/mobile dev -- --clear"
