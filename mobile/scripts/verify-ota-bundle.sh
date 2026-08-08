#!/usr/bin/env bash
# verify-ota-bundle.sh — prove which commit the update currently on a channel
# was built from, and that that commit is safe to ship.
#
# Born from the 2026-08-08 incident: `eas update` was green for weeks while
# every published bundle pointed at a decommissioned backend. A green publish
# proves the upload worked, not that the contents are correct.
#
# Bundle bytes cannot be inspected without credentials — assets.eascdn.net
# answers 403 to an unauthenticated asset request, by design. So this verifies
# by PROVENANCE instead, which needs no Expo login:
#
#   1. Fetch the manifest exactly as expo-updates would -> update id, runtime.
#   2. Find the `ota` workflow run that published that id -> the commit SHA.
#   3. Inspect that commit's mobile/lib/api.ts -> the hosts it baked in.
#
# Step 3 is the one that matters: the API host is a compile-time default, so
# the commit tells you exactly what the bundle contains.
#
# Usage:
#   ./scripts/verify-ota-bundle.sh                        # android, runtime 1, preview
#   ./scripts/verify-ota-bundle.sh --channel production
set -euo pipefail

PROJECT_ID="a2177bd7-0417-4823-9c4a-fe70ab11d07e"
UPDATE_URL="https://u.expo.dev/$PROJECT_ID"
GH_REPO="Perblis/Perblis_Terminal"
PLATFORM="android"
RUNTIME="1"
CHANNEL="preview"
EXPECT_HOST="terminal-api.lab.perblis.com"
DEAD_HOSTS=("api-production-101c8.up.railway.app" "terminal-portal.nwabueze.workers.dev")

ok()   { printf '  \033[32mOK\033[0m    %s\n' "$*"; }
bad()  { printf '  \033[31mFAIL\033[0m  %s\n' "$*"; }
warn() { printf '  \033[33mWARN\033[0m  %s\n' "$*"; }

while [ $# -gt 0 ]; do
  case "$1" in
    --platform) PLATFORM="${2:?}"; shift 2 ;;
    --runtime)  RUNTIME="${2:?}";  shift 2 ;;
    --channel)  CHANNEL="${2:?}";  shift 2 ;;
    --expect)   EXPECT_HOST="${2:?}"; shift 2 ;;
    -h|--help)  sed -n '2,22p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

WORK="$(mktemp -d)"; trap 'rm -rf "$WORK"' EXIT
STATUS=0

# ------------------------------------------------------------ 1. manifest
echo "==> manifest ($PLATFORM, runtime $RUNTIME, channel $CHANNEL)"
CODE="$(curl -s -o "$WORK/m.txt" -w '%{http_code}' \
  -H "expo-platform: $PLATFORM" -H "expo-runtime-version: $RUNTIME" \
  -H "expo-channel-name: $CHANNEL" -H "expo-protocol-version: 1" \
  -H "accept: multipart/mixed, application/expo+json, application/json" \
  "$UPDATE_URL")"

case "$CODE" in
  200) ok "HTTP 200 — an update is being served" ;;
  204) bad "HTTP 204 — nothing published for runtime '$RUNTIME' on channel '$CHANNEL'"; exit 1 ;;
  404) bad "HTTP 404 — channel '$CHANNEL' does not exist on this project"; exit 1 ;;
  400) bad "HTTP 400 — malformed request headers"; exit 1 ;;
  *)   bad "HTTP $CODE — unexpected"; exit 1 ;;
esac

UPDATE_ID="$(python3 - "$WORK/m.txt" <<'PY'
import json, re, sys
raw = open(sys.argv[1], "rb").read().decode("utf-8", "replace")
m = re.search(r'\{"id":.*?\}\s*(?=\r?\n-{3,})', raw, re.S) or re.search(r'\{"id":.*\}', raw, re.S)
if not m: sys.exit("could not locate the manifest JSON")
d = json.loads(m.group(0))
print(d["id"])
sys.stderr.write(f"  created   {d['createdAt']}\n  runtime   {d['runtimeVersion']}\n  assets    {len(d.get('assets', []))}\n")
PY
)"
echo "  update    $UPDATE_ID"

# ------------------------------------------------------- 2. find the commit
echo "==> provenance"
if ! command -v gh >/dev/null 2>&1; then
  warn "gh not available — cannot map the update to a commit; stopping after the manifest check"
  exit 0
fi

COMMIT=""
for RUN in $(gh run list -R "$GH_REPO" --workflow=ota.yml --limit 8 \
             --json databaseId,conclusion --jq '.[] | select(.conclusion=="success") | .databaseId'); do
  JOB="$(gh run view -R "$GH_REPO" "$RUN" --json jobs --jq '.jobs[0].databaseId' 2>/dev/null || true)"
  [ -n "$JOB" ] || continue
  LOG="$(gh api "/repos/$GH_REPO/actions/jobs/$JOB/logs" 2>/dev/null || true)"
  if grep -qF "$UPDATE_ID" <<<"$LOG"; then
    COMMIT="$(grep -oE 'Commit +[0-9a-f]{40}' <<<"$LOG" | head -1 | awk '{print $2}')"
    ok "published by ota run $RUN"
    break
  fi
done

if [ -z "$COMMIT" ]; then
  warn "could not tie this update to an ota run (log retention, or it was published manually)"
  warn "check by hand: https://expo.dev/accounts/perble/projects/terminal/updates"
  exit 0
fi
ok "built from commit ${COMMIT:0:12}"

# --------------------------------------------- 3. what that commit baked in
echo "==> hosts compiled into that commit's lib/api.ts"
if ! git cat-file -e "$COMMIT^{commit}" 2>/dev/null; then
  warn "commit $COMMIT not present locally — run 'git fetch' and retry"
  exit 0
fi
API_TS="$(git show "$COMMIT:mobile/lib/api.ts" 2>/dev/null || git show "$COMMIT:app/lib/api.ts" 2>/dev/null || true)"
[ -n "$API_TS" ] || { warn "lib/api.ts not found at that commit"; exit 0; }

if grep -qF "$EXPECT_HOST" <<<"$API_TS"; then
  ok "expected host present: $EXPECT_HOST"
else
  bad "expected host ABSENT: $EXPECT_HOST"
  STATUS=1
fi
for dead in "${DEAD_HOSTS[@]}"; do
  if grep -qF "$dead" <<<"$API_TS"; then
    bad "decommissioned host PRESENT: $dead — this bundle will break the app"
    STATUS=1
  else
    ok "absent, as required: $dead"
  fi
done

echo
if [ "$STATUS" -eq 0 ]; then
  echo "VERDICT: the update on channel '$CHANNEL' is safe to install."
else
  echo "VERDICT: DO NOT install or rely on this update — merge a corrected main and let ota.yml republish."
fi
exit "$STATUS"
