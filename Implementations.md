# Implementations — agent progress log

Append-only handoff log so any Claude/agent instance can resume mid-stream.
Skim **Current status** first, then the newest log entries. The entry format and
the session-start protocol that drives this file live in `CLAUDE.md`.

---

## Current status — _keep this section current_

**Wave:** Wave 0 built + deployed. **Wave 1 (accounts/auth/verification) MERGED to `main`** (PR #7, 2026-06-16) — auto-deploys backend. TSD §3.3/§3.8 reconciled to match (PR pending).

- **Built:** backend `core`; `accounts` now full Wave 1 — register + Termii OTP, JWT login/refresh/logout, password reset, me/roles, verification + Ops admin queue, soft-delete + purge. `packages/tokens`; `portal` hello-world; CI green on `main`.
- **Not built:** domain apps `suppliers listings search hires payments messaging ops` still empty (Waves 2+).
- **Deploy:** Railway api + worker + PostGIS live — `/healthz` + `/readyz` green. **Portal on Cloudflare Workers: PENDING**.
- **Integrations:** Termii/Resend/R2 client code shipped with dev fallbacks (console OTP / Mailpit / local-disk). Live keys still to be set in Railway env for the prod demo.
- **Decisions since specs:** D-017 = MVP payment provider **Bachs.io** (collect-only), supersedes Paystack in D-006; integration lands in Wave 4.

**Next:**
1. Set live Termii/Resend/R2 keys in Railway; run the founder demo (register→OTP→verify→login→submit ID→approve→Verified).
2. Finish Wave 0 exit — deploy the Supplier Portal to Cloudflare Workers.
3. **Wave 2** — _gated, needs founder approval_.

**Live:** https://perblisterminal-production.up.railway.app/healthz

---

## Log — _append new entries at the bottom_

## 2026-06-15 00:00 (local) - Railway MCP install for Cursor
- tag: CHORE
- area: Cursor MCP config (C:\Users\nwabu\.cursor\mcp.json)
- summary: Ran `railway mcp install --agent cursor` to register Railway's local stdio MCP server in Cursor.
- reason: User requested Railway MCP agent setup for Cursor.
- notes: Restart Cursor for the MCP server to register. Uses local CLI-backed server (`railway mcp`), not remote OAuth server.

## 2026-06-16 00:20 (local) - Railway setup agent for workspace
- tag: CHORE
- area: Railway CLI agent tooling (skills + MCP); D:\Projects\Terminal
- summary: Ran 
ailway setup agent -y from project root. Installed use-railway skill to Universal (.agents), Claude Code, Factory Droid, and Cursor; configured MCP for Claude Code and Factory Droid. Cursor MCP already present in mcp.json from prior install.
- reason: User confirmed full Railway agent tooling setup for Cursor and related editors.
- change_ref: 2026-06-15 00:00 (local) - Railway MCP install for Cursor
- notes: CLI reported already logged in (nwabueze.finance@gmail.com). Restart Cursor recommended to load skills and MCP. Cursor railway MCP: command railway, args mcp.

## 2026-06-16 (local) - Railway failed deploy log gather (resplendent-gentleness)
- tag: CHORE
- area: Railway project resplendent-gentleness; Perblis_Terminal + Worker services
- summary: Pulled build/deploy logs for latest FAILED deployments via CLI (44322e9a main, d21b1fe8 worker). Docker build succeeded; deploy failed on gunicorn `` literal and healthcheck; reported to user for manual fix.
- reason: User requested failure logs only�no redeploy or config changes.
- notes: Awaiting user before continuing deployment.

## 2026-06-16 01:10 (local) - Railway deploy fix (resplendent-gentleness)
- tag: FIXED
- area: backend/railway.json, backend/railway.worker.json, backend/Procfile, backend/Dockerfile, backend/settings/prod.py; Railway services Perblis_Terminal + Perblis_Terminal Worker
- summary: Fixed PORT expansion (`/bin/sh -c` + `${PORT:-8000}`), split shared vs per-service Railway config (removed startCommand/healthcheck from railway.json; set web/worker start commands via Railway environment config), added railway.worker.json, hardened Dockerfile CMD fallback, disabled SECURE_SSL_REDIRECT default for Railway internal HTTP healthchecks. Deployed web + worker via `railway up` from repo root.
- reason: Gunicorn failed with literal `$PORT`; railway.json startCommand overrode worker dashboard config; healthcheck failed on internal HTTP due to SSL redirect.
- change_ref: 2026-06-16 (local) - Railway failed deploy log gather (resplendent-gentleness)
- notes: Live https://perblisterminal-production.up.railway.app/healthz returns 200. Worker SUCCESS on db_worker. Push local changes to GitHub for durable auto-deploy; set worker service config file to `/backend/railway.worker.json` in dashboard if git-only worker deploys regress.

## 2026-06-16 04:20 (local) - Railway PostGIS wiring and deploy follow-up
- tag: CHORE
- area: Railway resplendent-gentleness; Perblis_Terminal + Worker + PostGIS; backend/railway.json, railway.worker.json, Dockerfile, Procfile, settings/prod.py
- summary: Verified PostGIS connected to web and worker via `DATABASE_URL` (`postgis://` + `postgis.railway.internal:5432`) on both services per DEPLOY.md. Production probes pass (`/healthz`, `/readyz` database ok; worker `db_worker` running). Restored web `startCommand`/`healthcheckPath` in `railway.json`; added `railway.worker.json` for worker-only start. Redeployed web from local fixes after env-var change triggered failed main-branch deploy (`$PORT` literal).
- reason: User requested Railway deployment follow-up � DB wiring verification, endpoint tests, wave-zero check, and PR for durable git deploy.
- change_ref: 2026-06-16 01:10 (local) - Railway deploy fix (resplendent-gentleness)
- notes: Portal Cloudflare Workers deploy still pending (wave-0 exit partial). Worker `railway.worker.json` config path should be set in Railway dashboard when git auto-deploy lands. R2/Bachs integrations `not_configured` in readyz (expected).

## 2026-06-16 04:45 (local) - Git branch push for Railway deploy PR
- tag: CHORE
- area: git branch deploy/railway-wave0-followup; .gitignore
- summary: Pushed deploy fixes to `origin/deploy/railway-wave0-followup` (commits 0150715, 4a12ba3, 127386d). Removed tracked `.cursor/settings.json`; added `.cursor/` to `.gitignore`. Production redeployed SUCCESS from repo root for web + worker.
- reason: Durable git-based auto-deploy on merge to main; PR workflow per user request.
- change_ref: 2026-06-16 04:20 (local) - Railway PostGIS wiring and deploy follow-up
- notes: `gh` installed but not authenticated � user must `gh auth login` then create PR, or open compare URL manually.

## 2026-06-16 06:30 - Session-start protocol + progress-tracking convention
- tag: CHORE
- area: CLAUDE.md, Implementations.md
- summary: Updated CLAUDE.md "Current state" to reflect Wave 0 built + backend deployed (was stale "pre-build"). Added a "Session start protocol" (read Implementations.md, study design.md/docs, derive precise wave status from code not just docs, confirm the founder-approved next wave) and a "Tracking progress" section defining the Implementations.md entry format. Gave Implementations.md a self-describing header + a maintained "Current status" snapshot.
- reason: User wants every new session to scan/understand the codebase, pin down exactly which wave is done and what's next, and use Implementations.md as the durable handoff log.
- change_ref: 2026-06-16 04:45 (local) - Git branch push for Railway deploy PR
- notes: Verified in code: only core+accounts have models (User mig 0001); domain apps empty; no /api/v1/ endpoints — i.e. Wave 0 only. Branch docs/session-protocol → draft PR. Next instances: keep "Current status" current and append here per change.

## 2026-06-16 07:30 - Wave 1: accounts identity, auth, verification
- tag: FEATURE
- area: backend/accounts (models, services/, integrations/, views, serializers, urls, admin, tasks, tests), settings/base.py, core/urls.py, backend/openapi/schema.yml, .env.example, pyproject (boto3+httpx)
- summary: Implemented Wave 1 end-to-end. Models: User gains full_name, NDPR consent timestamps, token_version, phone_verified_at, purged_at; new OtpCode, VerificationRequest (one-pending-per-kind partial-unique), PasswordResetToken. Auth: register (hirer/basic + consent) → Termii OTP (HMAC-hashed, 10-min, 3 resends/h, 5 attempts) → JWT login (60m access / 7d rotating refresh, custom claims) with IP failure-lockout (5/15min) + suspended/deleted/phone-not-verified guards; refresh re-validates user + tv; logout blacklists refresh; no-enumeration password reset that bumps token_version (kills live access+refresh). me GET/PATCH, activate-supplier. Verification: direct-multipart upload → private R2 (local-disk fallback) with 15-min presigned/Ops-only access; Django admin review queue (pending-first, doc links, approve→level upgrade + notify, reject→reason + notify, resubmit). DELETE me soft-delete + active_hire_guard stub; daily purge task scrubs PII after 30d, retains verification records (NDPR), idempotent. Custom TerminalJWTAuthentication enforces tv.
- reason: Founder approved starting Wave 1 (D: 2026-06-16). Builds the identity foundation Waves 2/4/7/8 depend on; contract freezes at wave end.
- change_ref: 2026-06-16 06:30 - Session-start protocol + progress-tracking convention
- notes: All gates green locally — 80 tests / 93% cov (gate 70%), ruff+format, mypy, makemigrations --check, .env.example. OpenAPI committed at backend/openapi/schema.yml (auth/* + me + verification, frozen). Dev integrations only — set Termii/Resend/R2 keys in Railway for the prod demo. SPEC GAPS flagged in PR: DELETE /api/v1/me missing from TSD §3.8; added User columns (full_name, phone_verified_at, consent, token_version, purged_at); new deps boto3+httpx; dedicated PasswordResetToken model; direct-multipart verification upload (generic presign deferred to Wave 2); login-lockout(failures) vs login throttle(requests) are complementary; prod needs a shared cache (DB-cache) for multi-worker lockout. Tests use local PostGIS — env injects a remote Supabase DATABASE_URL that can't build a test DB; override DATABASE_URL to localhost when running tests/migrations locally.

## 2026-06-16 10:50 - TSD reconciliation for Wave 1 deltas
- tag: DECISION
- area: docs/v2/07_TSD.md (§3.3 schema, §3.8 inventory)
- summary: Closed the spec gaps flagged when Wave 1 merged. §3.8 inventory now lists DELETE me (soft-delete + active_hire_guard). §3.3 users gains full_name, phone_verified_at, consent timestamps, token_version, purged_at; otp_codes notes HMAC code_hash + consumed_at; added password_reset_tokens; verification_requests gains rc_number/decided_at + one-pending-per-kind. Added a "Wave 1 build notes" callout: login throttle(5/min)+failure-lockout(5/15min) split, tv-claim session invalidation, direct-multipart verification upload (presign deferred to Wave 2), prod shared-cache note, boto3+httpx deps.
- reason: Founder requested reconciling the implemented-vs-spec deltas in the docs (PR #7 follow-up item).
- change_ref: 2026-06-16 07:30 - Wave 1: accounts identity, auth, verification
- notes: PDF mirrors in docs/v2/pdf/ NOT regenerated (scripts/md2pdf.py) — run if the PDF snapshot matters. No code change.
