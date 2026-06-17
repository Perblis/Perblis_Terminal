# Implementations — agent progress log

Append-only handoff log so any Claude/agent instance can resume mid-stream.
Skim **Current status** first, then the newest log entries. The entry format and
the session-start protocol that drives this file live in `CLAUDE.md`.

---

## Current status — _keep this section current_

**Wave:** Wave 0 built + deployed. **Wave 1 (accounts/auth/verification) COMPLETE — all merged to `main`** (PRs #7–#13). **Wave 2 (Supply: supplier profiles, yards, spec templates, listings CRUD + publish) is the founder-approved next wave — starting now in a fresh instance.** Local suite green (91 tests, 92.85% cov).

- **Built:** backend `core`; `accounts` = full Wave 1 — register + **independent two-channel verification** (phone via SMS / email via Resend, both required for login), JWT login/refresh/logout (rotating + blacklist + `tv` session-invalidation), no-enumeration password reset, `GET/PATCH/DELETE me`, activate-supplier, verification docs (private R2) + Ops admin review queue, soft-delete + NDPR purge. Migrations `0001`–`0005`. Frozen OpenAPI `backend/openapi/schema.yml`. `packages/tokens`; `portal` hello-world; CI green on `main`.
- **Not built:** domain apps `suppliers listings search hires payments messaging ops` still empty — Wave 2 fills `suppliers`/`listings` first.
- **Deploy:** Railway api + worker + PostGIS live — `/healthz` + `/readyz` green. Prod **must** keep `TERMII_API_KEY` set (phone OTP fails loudly, no silent fallback). **Portal on Cloudflare Workers: PENDING** (Wave 0 portal exit still open).
- **Integrations:** R2 + Resend verified working with founder keys. OTP inline (no worker): phone code SMS-only (loud `otp_delivery_failed` on prod failure; console in dev), email code email-only. `DEFAULT_FROM_EMAIL` = contact@perblis.com.
- **Decisions since specs:** D-017 = MVP payment provider **Bachs.io** (collect-only), supersedes Paystack in D-006; integration lands in Wave 4.

**Next (Wave 2 — read `docs/waves/wave-2.md` first):**
1. **Wave 2** is approved — supplier profiles, yards, spec templates, listings CRUD + publish (wave-2.md / FSD §5–6 / TSD). **Wave 1's auth contract is frozen — consume it, don't break it.** Note the publish gate uses the verified account levels Wave 1 established.
2. Known minor follow-up (non-blocking): `accounts/integrations/email.py::send_otp_email` copy still reads "verify your phone" / "fallback" — should read "verify your email" (it's now the dedicated email-channel sender). One-line copy fix.
3. Still open from Wave 0: deploy the Supplier Portal to Cloudflare Workers.

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

## 2026-06-16 12:45 - Wave 1 test run + bcrypt dependency fix
- tag: FIX
- area: backend/pyproject.toml, backend/uv.lock
- summary: Ran full Wave 1 test suite locally (80 tests, 93% cov, ruff/mypy/migrations green). Found runtime registration broken in dev/prod settings: `BCryptSHA256PasswordHasher` requires the `bcrypt` package but it was missing from dependencies (tests masked this via MD5 hasher). Added `bcrypt>=4.2`; verified register → OTP verify → login smoke test passes.
- reason: User requested Wave 1 tests and functional verification.
- change_ref: 2026-06-16 07:30 - Wave 1: accounts identity, auth, verification
- notes: Local test env needs PostGIS (`DATABASE_URL=postgis://postgres:postgres@localhost:5432/terminal`). Integration keys (Termii/Resend/R2) optional in dev — console/Mailpit fallbacks work. PR: cursor/wave1-test-bcrypt-fix-5d9a.

## 2026-06-16 12:20 - OTP email fallback when Termii absent
- tag: FIX
- area: accounts/integrations/email.py, tasks.py, services/otp.py, settings/base.py, .env.example
- summary: When Termii is not configured (SMS console fallback), OTP is now also emailed via Resend so register→verify works without SMS keys. Updated DEFAULT_FROM_EMAIL default to `contact@perblis.com` (verified in Resend; perblis.io is not).
- reason: User received welcome email but no OTP code — SMS-only delivery with no Termii key.
- change_ref: 2026-06-16 07:30 - Wave 1: accounts identity, auth, verification
- notes: Production still uses Termii SMS when `TERMII_API_KEY` is set; email is fallback only. R2 + Resend verified working with founder keys. PR: cursor/otp-email-fallback-5d9a.

## 2026-06-16 12:30 - Review merged Cursor PRs (#9 bcrypt, #10 OTP email) + TSD note
- tag: CHORE
- area: docs/v2/07_TSD.md (§3.8 build notes), Implementations.md
- summary: Reviewed two merged Cursor PRs against main. #9 (add bcrypt dep) — correct, necessary: BCryptSHA256PasswordHasher needs bcrypt at runtime; tests masked it via MD5. #10 (email OTP when Termii absent) — sound, tested, OpenAPI unchanged (internal task signature only). Validated main: 81 tests green, schema unchanged. Updated the TSD §3.8 build-notes callout to document the OTP email fallback + the prod caution (must keep TERMII_API_KEY set or phone-channel verification silently degrades to email) and bcrypt as a runtime dep.
- reason: Founder asked to review the externally-merged changes and update affected docs.
- change_ref: 2026-06-16 10:50 - TSD reconciliation for Wave 1 deltas
- notes: No code change. OpenAPI not regenerated (no contract drift). Possible future hardening: warn/refuse in prod when TERMII_API_KEY is unset rather than silently emailing OTPs — flagged to founder.

## 2026-06-16 13:20 - Two-channel verification (separate email + phone OTP)
- tag: FEATURE
- area: backend/accounts (models, enums, errors, services/{otp,delivery,login,registration}, views, serializers, urls, throttles, tasks, factories, tests, migrations 0004/0005), backend/openapi/schema.yml, docs/v2/06_FSD_v2.md §4.2, docs/v2/07_TSD.md §3.3/§3.8
- summary: Replaced the cross-channel "email the phone OTP" fallback (PRs #10/#12) with independent verification of each channel. Phone OTP delivered ONLY by SMS (Termii); email OTP delivered ONLY by email (Resend) — codes never crossed, so an email can't prove phone ownership. Phone delivery is loud, not silent: raises `otp_delivery_failed` (502) when SMS can't be sent (provider error, or no TERMII_API_KEY in prod); dev (DEBUG) prints to console. New: User.email_verified_at + is_email_verified; OtpPurpose.EMAIL_VERIFY; errors EmailNotVerified (403) + OtpDeliveryFailed (502); endpoints auth/email/verify + auth/email/resend (email-keyed throttle); MeSerializer.is_email_verified. Login (Basic) now requires BOTH phone and email verified (FSD §4.1). Registration issues both OTPs inline (resilient: a channel failure is logged, account still created, resend is the strict path). Removed orphaned dispatch_otp_sms task + deliver_otp.
- reason: Founder asked to verify email as well as mobile, with mobile not silently failing.
- change_ref: 2026-06-16 12:20 - OTP email fallback when Termii absent
- notes: Green locally — 91 tests / 92.85% cov, ruff+format, mypy, makemigrations --check, OpenAPI regenerated. Contract change (reopens frozen Wave 1 auth contract) — founder-requested. FSD §4.2 + TSD §3.3/§3.8 updated to match. Branch: feature/two-channel-verification.

## 2026-06-16 14:00 - Wave 1 close-out + Wave 2 handoff doc sync
- tag: CHORE
- area: CLAUDE.md (current-state), docs/waves/README.md (status column), Implementations.md (current status)
- summary: Marked Wave 1 COMPLETE (PRs #7–#13 merged: accounts incl. independent email+phone OTP, both required for login) across the handoff docs, and Wave 2 as the founder-approved next wave. CLAUDE.md "Current state" now describes the full accounts surface (migrations 0001–0005, frozen OpenAPI, TERMII_API_KEY required in prod). waves/README.md status: Wave 0 ✅ (portal deploy still pending), Wave 1 ✅, Wave 2 🟡 approved & starting.
- reason: Founder is about to start Wave 2 in a fresh instance and asked for the handoff docs to be brought current.
- change_ref: 2026-06-16 13:20 - Two-channel verification (separate email + phone OTP)
- notes: Next instance: read Implementations.md → design.md → docs/waves/wave-2.md → FSD/TSD §5–6. Wave 1 auth contract is frozen (breaking it needs founder sign-off). Known non-blocking nit recorded: send_otp_email copy says "phone" instead of "email". Local DB for tests needs PostGIS + DATABASE_URL=postgis://postgres:postgres@localhost:5432/terminal (env injects a remote Supabase URL that can't build a test DB).

## 2026-06-17 - Add "prepare for handoff" protocol to CLAUDE.md
- tag: CHORE
- area: CLAUDE.md (new "Handoff protocol" section)
- summary: Documented a repeatable handoff checklist triggered when the founder says "prepare for handoff": sync to main, reconcile FSD/TSD + regenerate OpenAPI if contracts changed, refresh Implementations.md (current status + log entry), CLAUDE.md current-state, docs/waves/README.md status column, record known follow-ups, then open a docs-only draft PR.
- reason: Founder wants the handoff doc-sync routine codified so any instance runs it on command.
- change_ref: 2026-06-16 14:00 - Wave 1 close-out + Wave 2 handoff doc sync
- notes: Added to PR #14 (docs/wave2-handoff). Documentation convention only.
