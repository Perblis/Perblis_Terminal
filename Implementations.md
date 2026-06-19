# Implementations — agent progress log

Append-only handoff log so any Claude/agent instance can resume mid-stream.
Skim **Current status** first, then the newest log entries. The entry format and
the session-start protocol that drives this file live in `CLAUDE.md`.

---

## Current status — _keep this section current_

**Wave:** Waves 0, 1, 2, **3 COMPLETE & merged to `main`**; backend deployed on Railway (auto-deploy from `main` to the **natural-cat** project). **Wave 4 (Hires & Money — state machine, fees, Paystack/Bachs, payouts) is the next wave — GATED on explicit founder go** (wave gating is binding; design.md §7). **Read `docs/waves/wave-4.md` first** — it is the heaviest wave (six ordered slices 4A–4F, **85% coverage gate** on `hires`/`payments`), citing FSD §3 (money rules = test vectors) / §7 (hire lifecycle state table) / §9 (notifications) + TSD §3.2–§3.6 + D-002/004/005/006/008/014/015. Local suite green (~226 tests, ~93.7% cov).

- **Built:** backend `core` + full Wave 1 `accounts` + Wave 2 `suppliers` + `listings` + **Wave 3 `search`** (merged via PRs #23/#24/#25). Wave 2 recap: supplier profile (Fernet bank #), yards (PostGIS pins, delete-guard, 100m inference), 36 spec templates, listings CRUD + publish gates (`listings/state.py` = only status writer), photos, duplicate, reports, storefronts, `core/media` presign. **Wave 3 `search`** (read-only, no new models/migrations): `GET /api/v1/search/map` (server-side yard aggregation — ≥2 Live listings = yard pin with authoritative `listing_count`/`matching_count`/`class_mix`/`price_from` + embedded summaries; else solo pins; zero-match yards persist dimmed), `GET /api/v1/search/list` (`group_by=asset` with `more_at_yard` | `location` interleaved; keyset cursor pagination in `search/pagination.py`, stable under inserts), `GET /api/v1/geocode` (LocationIQ server-side, 24h cache via Django cache fwk, key never leaves server, graceful when unset). Shared primitives in `search/services/common.py`; ★-spec filter via `listings.spec_data.star_field()`. Migrations unchanged: accounts 0001–0005, suppliers 0001–0002, listings 0001–0005. **OpenAPI `backend/openapi/schema.yml`** now also carries the (frozen) search contracts.
- **Wave 3 exit:** P95 **165–180 ms** on 500 seeded listings (gate <500 ms; hot bbox query EXPLAIN ANALYZE = 3.5 ms SQL), N+1-free (≤6 queries at scale). All four canonical map cases + list + geocode demonstrated locally via `manage.py seed_search_demo --listings 500`. **Record explicit founder sign-off when confirming Wave 4 go.**
- **Ops Console (admin):** Django admin themed "Terminal Ops Console" (Heavy Duty CSS via WhiteNoise + manifest static), styled & live in prod — **visual-only**; functional Ops Console (queues/dashboards/2FA/disputes) is still **Wave 6**.
- **Not built:** domain apps `hires payments messaging ops` still empty (Waves 4+). **Wave 4 builds `hires` + `payments`** and closes the Wave-3 `available`-stub (wire real availability into search payloads, drop the stub note from the search schema).
- **Deploy:** Railway api + worker + PostGIS live on the **natural-cat** project — api at **https://api-production-101c8.up.railway.app** (`/healthz` + `/readyz` green; bachs `not_configured`). Both services auto-deploy on merge to `main` (root dir `backend`; worker keeps `configFile=/backend/railway.worker.json`). Deploy-time DB work via `manage.py deploy` under a Postgres advisory lock — race-free. Static baked at `docker build`. Prod **must** keep `TERMII_API_KEY` set (phone OTP fails loudly).
- **Integrations:** R2 + Resend verified. OTP inline: phone SMS-only, email email-only. `DEFAULT_FROM_EMAIL` = contact@perblis.com. **`LOCATIONIQ_KEY` NOT yet set in prod** → `/api/v1/geocode` returns `provider_configured:false` / empty until set. **Termii sender approval still PENDING** (real SMS 502); Ops admin channel-verify is the interim onboarding path.
- **Decisions since specs:** D-017 = MVP payment provider **Bachs.io** (collect-only), supersedes Paystack in D-006 — integration lands in **Wave 4** (NB: wave-4.md prose still says "Paystack"; the provider is Bachs per D-017 — same webhook/verify-before-transition shape).

**Next — Wave 4 (Hires & Money), once founder-approved:**
1. **Confirm founder go** for Wave 4 and record the explicit approval (and Wave 3 sign-off) before writing code.
2. Build `hires` + `payments` as the six ordered slices in `docs/waves/wave-4.md`: **4A** fee engine (`hires/fees.py`, pure; 5 FSD §3.1 worked examples verbatim + hypothesis props) → **4B** hire model + `hires/state.py` state machine + `availability.py` (binding `SELECT FOR UPDATE` race rule; **close the Wave-3 `available` stub**) → **4C** request/accept/decline/expire (D-014 role-shaped serializers; Basic cap) → **4D** payment provider webhook (HMAC verify, dedup, verify-before-transition; refund table) → **4E** timers/sweeps + handovers + disputes → **4F** payouts + reconciliation + notifications. 85% coverage gate on `hires`/`payments`; money is integer kobo; financial fields lock at acceptance.

**Carry-over follow-ups (non-blocking):**
- **Wave 3:** `badge` has two meanings (documented in `search/services/common.py`) — solo-pin/list-row `badge` = listing trust tier; yard `supplier.badge` = account verification. Founder may override before downstream (Wave 8) consumes the frozen contract. The `available` flag is a Wave-3 stub (always `true`) — **Wave 4 §4B wires the real availability engine** and removes the stub note from the search OpenAPI schema.
- Set **`LOCATIONIQ_KEY`** in the natural-cat prod env so geocode returns results; update `CORS_ALLOWED_ORIGINS` when the portal Workers URL is known.
- `accounts/integrations/email.py::send_otp_email` copy still reads "verify your phone" / "fallback" — should read "verify your email". One-line copy fix.
- Wave 2 DEFERRED (founder call): "Other (describe)" asset type → Ops review NOT built (unknown types rejected with `invalid_asset_type`; Ops surfaces are Wave 6). Photo orphan-sweep task is a logged no-op until an upload ledger / R2 lifecycle policy lands.
- Still open from Wave 0: deploy the **Supplier Portal to Cloudflare Workers** (portal exit criterion).
- Termii SMS sender approval (above) for the real phone-OTP flow.

**Local test-DB:** PostGIS via `docker compose up -d`; `pytest -x` (coverage gates: 85% hires/payments, 70% overall). **Live (current auto-deploy = natural-cat):** https://api-production-101c8.up.railway.app/healthz (earlier project `perblisterminal-production` may also still be up).

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

## 2026-06-17 - Wave 2 Slice 0: media presign pipeline + supplier profile
- tag: FEATURE
- area: backend/core (media.py, fields.py, encryption.py, views.py, serializers.py, urls.py, tests/test_media.py), backend/suppliers (models, services/profile, serializers, views, urls, admin, factories, migrations/0001, tests), backend/conftest.py, settings/base.py, backend/openapi/schema.yml
- summary: First Wave 2 slice. Added the cross-cutting media pipeline `POST /api/v1/media/presign` (kind-scoped presigned PUT: listing_photo/avatar/logo/verification_doc/handover_photo with per-kind content-type + size caps per TSD §3.9; public vs private bucket; stable codes media_kind_invalid/media_content_type_invalid/media_too_large) in `core/media.py`, plus dev/CI local upload+serve receivers (excluded from schema) so the round-trip works without R2. Added `core.encryption` (Fernet, FIELD_ENCRYPTION_KEY with SECRET_KEY-derived dev fallback) + `core.fields.EncryptedTextField`. Built `suppliers.SupplierProfile` (business name, description, logo_key, bank_name, bank_account_number_enc **encrypted at rest**, bank_account_name, 4 notif bools, strike_count) with `GET/PATCH /api/v1/suppliers/me/profile` (IsSupplier; bank number write-only in / masked `****1234` out; is_complete gate helper for publish). Added shared root `conftest.py` (api/auth/supplier/hirer fixtures).
- reason: Wave 2 §2.1 + §2.5 — supplier business profile with encrypted bank details and the media pipeline every later slice (logos, listing photos) consumes.
- change_ref: 2026-06-16 14:00 - Wave 1 close-out + Wave 2 handoff doc sync
- notes: Green locally — 107 tests / 91.67% cov, ruff+format+mypy clean, makemigrations --check clean, OpenAPI regenerated (0 errors). Pinned ENUM_NAME_OVERRIDES so the new media `kind` enum (MediaKindEnum) does NOT rename the frozen Wave-1 verification `KindEnum` — verified no `kind` drift vs main. Local test/dev DB needs PostGIS + `DATABASE_URL=postgis://postgres:postgres@localhost:5432/terminal` and `DJANGO_SETTINGS_MODULE=settings.test` (env injects a remote Supabase URL + config.settings.production that must be overridden). Next: Slice 1 — Yards.

## 2026-06-17 - Add "prepare for handoff" protocol to CLAUDE.md
- tag: CHORE
- area: CLAUDE.md (new "Handoff protocol" section)
- summary: Documented a repeatable handoff checklist triggered when the founder says "prepare for handoff": sync to main, reconcile FSD/TSD + regenerate OpenAPI if contracts changed, refresh Implementations.md (current status + log entry), CLAUDE.md current-state, docs/waves/README.md status column, record known follow-ups, then open a docs-only draft PR.
- reason: Founder wants the handoff doc-sync routine codified so any instance runs it on command.
- change_ref: 2026-06-16 14:00 - Wave 1 close-out + Wave 2 handoff doc sync
- notes: Added to PR #14 (docs/wave2-handoff). Documentation convention only.

## 2026-06-17 - Wave 2 Slice 1: Yards
- tag: FEATURE
- area: backend/suppliers (models.Yard, errors.YardHasListings, services/yards.py, serializers.YardSerializer, views Yard*View, urls, admin, factories.YardFactory, migrations/0002, tests/test_yards.py), backend/conftest.py (supplier2 fixture), .github/workflows/backend.yml (mypy now covers suppliers), backend/openapi/schema.yml
- summary: Added Yards (FSD §5.1): `GET/POST /api/v1/yards`, `PATCH/DELETE /api/v1/yards/:id` (IsSupplier, owner-scoped). `Yard` has a `geography(Point,4326)` GIST `point`; GeoJSON in/out via rest_framework_gis GeometryField. Delete is guarded by the listing→yard FK being PROTECT (added in the listings slice) — `yard.delete()` ProtectedError surfaces as stable `yard_has_listings`. Added `nearest_yard_within` (100m auto-yard inference helper for the listing form, FSD §5.1). Extended the CI mypy step to include `suppliers`.
- reason: Wave 2 §2.2 — supplier yards with map pins; listings attach to them next.
- change_ref: 2026-06-17 - Wave 2 Slice 0: media presign pipeline + supplier profile
- notes: Green locally — 114 tests / 91.53% cov, ruff+format+mypy clean, makemigrations clean, OpenAPI regenerated (yards paths added, no frozen-enum drift). Tests obtain introspected Yards via the service (typed return) not factory locals, to stay mypy-clean (factory_boy returns aren't typed for mypy). yard_has_listings block-path test lands with the listings slice (no Listing model yet). Next: Slice 2 — spec templates + seed.

## 2026-06-17 - Wave 2 Slice 2: spec templates + seed
- tag: FEATURE
- area: backend/listings (enums.AssetClass/SpecFieldKind, models.SpecTemplate, spec_data.py, services/{spec_seed,specs}, errors, serializers, views.SpecTemplateView, urls, admin, factories, management/commands/seed_spec_templates, migrations 0001+0002 data-seed, tests), backend/core/exceptions.py (TerminalError carries optional fields), core/urls.py (include listings), .github/workflows/backend.yml (mypy +listings), backend/openapi/schema.yml
- summary: Wave 2 §2.3. Added `SpecTemplate` (asset_class+asset_type+version uniq, fields jsonb) seeded from doc 05 §2–§6 via `spec_data.build_templates()` (36 templates: 15 plant / 9 trucks / 5 warehousing / 3 terminals / 4 land) — one ★ filterable headline per class (operating_weight·payload_capacity·floor_area·container_capacity·area). Idempotent `seed_spec_templates()` (upsert) used by both the management command and a data migration (0002). `GET /api/v1/spec-templates?class=&type=&version=` (public). `validate_specs(...)` checks field kinds/options always and required-fields when `require=True` (publish); `missing_required_specs` is the publish-gate helper; drops unknown fields; `invalid_asset_type`/`spec_invalid` codes. Enhanced `core.exceptions.TerminalError` to carry optional per-field `fields` (additive, backward-compatible) so custom-code errors surface field detail.
- reason: Wave 2 §2.3 — the spec registry listings validate against; publish gate needs required-spec checks.
- change_ref: 2026-06-17 - Wave 2 Slice 1: Yards
- notes: Green locally — 123 tests / 90.80% cov, ruff+format+mypy clean, makemigrations clean, OpenAPI regenerated (no frozen-enum drift). Run `manage.py seed_spec_templates` in prod (also applied by migration 0002). Next: Slice 3 — listings core (CRUD), which adds the listing→yard PROTECT FK that activates the yard delete-guard.

## 2026-06-17 - Wave 2 Slice 3: Listings core (CRUD)
- tag: FEATURE
- area: backend/listings (enums Listing{Status,Tier}/ReportReason, models.Listing+Unit, errors.ListingNotEditable, services/{listings,geocoding}, serializers Listing*, views Listing*View, urls, admin, factories.ListingFactory, migration 0003, tests/test_listings.py), backend/openapi/schema.yml
- summary: Wave 2 §2.4. `Listing` (+`Unit`) per TSD §3.3 — kobo pricing (daily required), specs validated + version stamped on create, location precedence yard→pin→geocode with denormalised `point`, stored `completeness_score` (not serialized). `GET/POST /api/v1/listings` (IsSupplier, mine), `GET /listings/:id` (public iff Live else owner-only 404), `PATCH /listings/:id` (Draft/Paused/Live editable; archived/removed → `listing_not_editable`). Yard FK is PROTECT → the yard delete-guard (`yard_has_listings`) is now live and tested. Auto-yard 100m suggestion returned on create. GIN index on specs; status+asset_class / supplier+status indexes. LocationIQ geocoding helper (graceful degrade without key). D-014: no fee fields on listings.
- reason: Wave 2 §2.4 — real listings can now be authored; publish/photos/state come next.
- change_ref: 2026-06-17 - Wave 2 Slice 2: spec templates + seed
- notes: Green locally — 135 tests / 89.92% cov, ruff+format+mypy clean, makemigrations clean, OpenAPI regenerated (listings paths added, no frozen-enum drift). status is never written in the service (state machine = Slice 4). DEFERRED: "Other (describe)" asset type → Ops review not implemented (unknown types rejected with invalid_asset_type; Ops surfaces are Wave 6) — flag for founder. Live-edit hire-term lock is a no-op until Wave 4 (asserted no cascade). Next: Slice 4 — photos + state machine (publish gates, pause/archive/duplicate).

## 2026-06-17 - Wave 2 Slice 4: photos + state machine (publish gates, duplicate)
- tag: FEATURE
- area: backend/listings (models.ListingPhoto, state.py, services/{photos,listings(transition+duplicate)}, errors publish-gate+photo, serializers photo/reorder/duplicate, views photo/action/duplicate, urls, factories.ListingPhotoFactory, tasks.sweep_orphan_photos, migration 0004, tests/test_publish.py), backend/openapi/schema.yml
- summary: Wave 2 §2.4/§2.5. `listings/state.py::apply` is the single status writer (Draft→Live⇄Paused→Archived; removed Ops-only). Publish gates (FSD §5.2), each a stable code: publish_requires_daily_price/_photo/_location/_specs (per-field), verification_required, business_profile_incomplete; tier auto-Basic at publish. `POST /listings/:id/{publish,pause,archive,duplicate}`. ListingPhoto (≤10 enforced, first photo auto-cover, reorder + single cover) via `POST /listings/:id/photos` + `PATCH /listings/:id/photos/order` (keys come from media/presign). Duplicate → new Draft copying class/type/specs/pricing/units/yard, tier resets Basic, optional photo-key copy (no re-upload). Weekly orphan-sweep task stub.
- reason: Wave 2 §2.4/§2.5 — listings can now go Live through enforced gates; fleet duplicate + photos complete the supply build.
- change_ref: 2026-06-17 - Wave 2 Slice 3: Listings core (CRUD)
- notes: Green locally — 147 tests / 91.25% cov, ruff+format+mypy clean, makemigrations clean, OpenAPI regenerated (listing action+photo paths, no frozen-enum drift). Publish-gate matrix fully tested (each missing precondition → its code). Orphan sweep is a logged no-op until an upload ledger / R2 lifecycle policy lands (flagged). Next: Slice 5 — reports + storefronts (closes the wave).

## 2026-06-17 - Wave 2 Slice 5: reports + storefronts (wave build complete)
- tag: FEATURE
- area: backend/listings (enums.ReportState, models.Report, services/{reports,storefront}, errors.ListingNotReportable, serializers Report*, views ListingReportView/StorefrontView, urls, admin.ReportAdmin, factories.ReportFactory, migration 0005, tests/test_reports_storefront.py), listings/services/listings.py (hide suspended-supplier listings)
- summary: Wave 2 §2.6 — closes the wave. `POST /api/v1/listings/:id/reports` (IsHirer, throttle 5/day/user, only Live listings → else 404); never auto-hides; **3 reports in 30 days sets `priority_review_flag`** (freezegun-tested, window-correct). Ops `ReportAdmin` shows the supplier's sibling listings. `GET /api/v1/storefronts/:supplier_id` (public): business name, logo, verification badge, member-since, about, yards (mini-map data + live count), Live listings (cover photo, ₦ display) — no hire CTA, no fee fields (D-014). Suspended/deleted supplier → storefront 404 AND listing-detail 404 (hidden together, FSD §5.3).
- reason: Wave 2 §2.6 — abuse reporting + the public supplier page; completes the Supply wave.
- change_ref: 2026-06-17 - Wave 2 Slice 4: photos + state machine
- notes: Green locally — 156 tests / 91.14% cov, ruff+format+mypy clean, makemigrations clean, OpenAPI regenerated (reports + storefronts paths, no frozen-enum drift). Lexicon-clean (no owner/renter/booking). All 6 Wave 2 slices on PR #15. Wave-end checklist remaining: prod seed, founder demo, founder approval before Wave 3.

## 2026-06-17 13:10 - FIX: concurrent-migrate race broke Wave 2 prod deploy
- tag: FIX
- area: backend/core/management/commands/deploy.py (new), backend/core/management/{__init__,commands/__init__}.py, backend/railway.json, backend/railway.worker.json, backend/Procfile, backend/core/tests/test_deploy_command.py
- summary: Wave 2 deploy crashed at the migrate step — `duplicate key value violates unique constraint "pg_type_typname_nsp_index"` / `Key (typname, typnamespace)=(listings, 2200)` while applying `listings.0003` (CreateModel `listings`). Root cause: BOTH the web (railway.json) and worker (railway.worker.json) services ran the identical `preDeployCommand: migrate --noinput && seed_superuser`, so on a deploy Railway boots them concurrently and two `migrate` processes race on `0003`. One wins (creates `listings`, records 0003); the loser — here the WEB pre-deploy — has already read the pre-migration state and dies on the duplicate CREATE, so the web deploy fails and the prior Wave-1 image keeps serving (confirmed live: `/healthz` 200 but `/api/v1/listings` 404 though the route is in merged main). Fix: new `manage.py deploy` command runs migrate + seed_superuser under a Postgres session advisory lock (`pg_advisory_lock(0x5445524D494E4C)`), so the second service waits then no-ops; both `preDeployCommand`s and the Procfile `release` now call it. `seed_superuser` is also check-then-create, so it's serialized too.
- reason: A green CI merge auto-deployed but the concurrent migrate race kept Wave 2 from going live; lock makes deploy-time DB work idempotent and race-free.
- change_ref: 2026-06-17 - Wave 2 Slice 5: reports + storefronts (wave build complete)
- notes: Because 0003 is atomic, the orphan `listings` table existing means the winning process DID commit and record 0003 — so the DB is already fully migrated and the next (serialized) deploy's migrate is a clean no-op that brings web live; no DB surgery expected. CONTINGENCY (only if a redeploy still hits the duplicate, i.e. 0003 somehow unrecorded): run a one-off on the api service — `python manage.py migrate listings 0003 --fake` if `listings`+`units`+the 3 indexes all exist, else `DROP TABLE IF EXISTS units, listings CASCADE` (orphan tables are empty — no listings feature was ever live) then `python manage.py deploy --noinput`. New tests (3) mock the cursor + call_command (no DB): lock-before-work, migrate-before-seed, unlock-on-error. ruff+format clean, makemigrations clean (no model changes).

## 2026-06-17 14:40 - FEATURE: brand the Django admin as the "Terminal Ops Console" (Heavy Duty theme)
- tag: FEATURE
- area: backend/settings/{base,prod}.py, backend/pyproject.toml, backend/templates/admin/base_site.html (new), backend/static/admin/css/heavy-duty.css (new), backend/static/admin/fonts/*.woff2 (new, vendored), backend/core/admin.py (new), backend/core/tests/test_admin_theme.py (new)
- summary: Visual theming of the admin (the Ops Console). Found the prod admin was rendering UNSTYLED — no WhiteNoise + gunicorn doesn't serve /static/ when DEBUG=False, so not even Django's own admin CSS loaded. Added `whitenoise` dep + `WhiteNoiseMiddleware` (right after SecurityMiddleware) and wired `STORAGES["staticfiles"] = CompressedManifestStaticFilesStorage` in prod.py ONLY (dev/test keep default storage so they need no collectstatic/manifest). Added project-level `templates/` (overrides admin/base_site.html — app-dir loading can't, admin precedes LOCAL_APPS) and `static/` dirs. New `heavy-duty.css` re-skins the admin by remapping Django's own admin CSS variables onto the design-system palette (amber-500 accent/fill, amber-600 link text to respect the forbidden contrast pair, ink #16181D, paper #F7F7F5, 1px borders, squared, no gradients) + light/dark coverage. Self-hosted Archivo/Inter/IBM Plex Mono woff2 (latin subset, ~115KB, no external CDN per design system) with system fallbacks. `core/admin.py` sets site_header "Terminal Ops Console" / site_title "Terminal Ops" / index_title "Operations" (lexicon). base_site.html adds an amber inline-SVG "T" mark + wordmark.
- reason: Founder asked to build out + beautify the admin. Scope confirmed = VISUAL THEMING ONLY (custom Heavy Duty CSS), explicitly NOT pulling Wave 6 Ops-Console features (dashboards/2FA/queues/disputes) forward; existing ModelAdmin classes left unchanged.
- change_ref: 2026-06-17 13:10 - FIX: concurrent-migrate race
- notes: No migrations, no API/contract change, no new env vars (.env.example unchanged). Verified: `collectstatic` under prod manifest storage succeeds (486 post-processed, font url()s rewritten to hashed names — proves every reference resolves; gzip variants emitted); base_site.html renders the branding DB-free; ruff+format clean. Tests: 4 in test_admin_theme.py — site labels + WhiteNoise-position pass locally; the 2 admin-render tests need Postgres (green in CI). Dark mode keeps Django's dark surfaces with the amber brand carried via vars. Follow-up (deferred, Wave 6): functional Ops Console (queues, dashboards, 2FA). After merge+deploy, confirm /admin/ renders themed in prod.

## 2026-06-17 15:15 - FIX: promote existing SEED_SUPERUSER + prod Wave 2 E2E via Ops admin
- tag: FIX
- area: backend/accounts/management/commands/seed_superuser.py, backend/accounts/admin.py, backend/accounts/tests/test_seed_superuser.py, scripts/admin_ops.py
- summary: `nwabueze@perblis.com` was registered in Wave 1 before `SEED_SUPERUSER_*` was set, so `seed_superuser` skipped and admin login failed. PR #18: promote existing email to staff/superuser + set password once; expose `email_verified_at` / editable channel timestamps in Ops admin. Post-deploy: promoted test user `nwabueze+wave2-live-1781705494@perblis.com` (verify phone+email, `account_level=verified`, `is_supplier`) via admin; full prod API E2E green — profile → yard → listing → R2 photo → publish Live → duplicate → storefront (`live_listings` count 1). Termii sender still `pending` (SMS 502); admin channel verify is the interim Ops path.
- reason: Founder provided SEED_SUPERUSER creds and asked to use Ops admin to unblock live Wave 2 testing while Termii approval is pending.
- change_ref: 2026-06-17 13:10 - FIX: concurrent-migrate race broke Wave 2 prod deploy
- notes: Admin URL https://perblisterminal-production.up.railway.app/admin/ — `nwabueze@perblis.com` now staff. `scripts/admin_ops.py` automates verify+promote (datetime fields `_0` date / `_1` time). Wave-end founder demo criterion met on prod API. Termii sender approval still needed for real phone OTP flow.

## 2026-06-17 15:35 - FIX: admin 500 in prod — bake static manifest at build + leading-slash STATIC_URL
- tag: FIX
- area: backend/Dockerfile, backend/settings/base.py
- summary: After the Heavy Duty admin theme merged (#19), prod `/admin/` returned HTTP 500. Root cause: the Dockerfile ran `collectstatic ... || true` under `settings.prod`, which requires `SECRET_KEY`/`ALLOWED_HOSTS`/`CORS_ALLOWED_ORIGINS` from env — absent at `docker build` time — so collectstatic failed and `|| true` swallowed it, shipping an image with NO `staticfiles.json` manifest. With `CompressedManifestStaticFilesStorage` (added in #19) the missing manifest makes every `{% static %}` raise → 500 on all admin pages (previously, default storage just rendered unstyled). Fix: run collectstatic with build-only throwaway env values (`SECRET_KEY=build-only ALLOWED_HOSTS=* CORS_ALLOWED_ORIGINS=...`) and DROP `|| true` (fail the build loudly). Also fixed `STATIC_URL` `"static/"` → `"/static/"` (no leading slash = assets resolve relative to the page path, e.g. /admin/login/static/…, breaking every link).
- reason: #19's manifest storage exposed a pre-existing build-time collectstatic failure; without the baked manifest the admin 500s instead of merely being unstyled.
- change_ref: 2026-06-17 14:40 - FEATURE: brand the Django admin as the "Terminal Ops Console" (Heavy Duty theme)
- notes: Verified locally by reproducing the build (collectstatic under settings.prod + build env → manifest present) then rendering the admin under settings.prod WITH the manifest → theme resolves to `/static/admin/css/heavy-duty.<hash>.css`, no ValueError. WhiteNoise serves the baked STATIC_ROOT at runtime. Build-only SECRET_KEY is scoped to the RUN command (not persisted as image ENV); Railway injects real values at runtime. URGENT: prod admin is 500ing until this merges + redeploys.

## 2026-06-18 - Prod demo: nwabueze@perblis.com as verified supplier
- tag: DEPLOY
- area: production API, scripts/admin_ops.py
- summary: Founder manually verified phone for `nwabueze@perblis.com`; agent promoted account via Ops admin (`is_supplier`, `account_level=verified`) and completed full supplier demo on prod API — profile (Perblis Plant & Haulage), yard (Apapa Main Yard), listing (CAT 320D published Live), duplicate draft, storefront with 1 live listing. 13/13 live checks passed.
- reason: Founder asked to set up their primary account as the live Wave 2 supplier demo.
- change_ref: 2026-06-17 15:15 - FIX: promote existing SEED_SUPERUSER + prod Wave 2 E2E via Ops admin
- notes: Storefront https://perblisterminal-production.up.railway.app/api/v1/storefronts/019ed075-5f3f-7336-8f20-334160a78c41 · Listing `019edb68-44a3-7389-8c20-702f398c7625` Live at ₦95,000/day. Fixed `admin_ops.py` login check (admin title is "Terminal Ops", not "Site administration").

## 2026-06-19 - Prod E2E demo on new Railway API (api-production-101c8)
- tag: DEPLOY
- area: production API (https://api-production-101c8.up.railway.app)
- summary: Full Waves 0–3 founder demo on the new prod URL after founder promoted `nwabueze@perblis.com` (supplier + verified). 21/21 steps passed: healthz → login → profile (Perblis Plant & Haulage) → Apapa Main Yard → CAT 320D published Live (₦95k/day, R2 photo) → duplicate draft → storefront (1 live) → search/map solo pin + search/list (asset + location) + radius + geocode (LocationIQ live, 2 results for Apapa Lagos). Wave 3 contracts live (31 OpenAPI paths).
- reason: Founder approved account setup and asked for full prod E2E on the new Railway deployment.
- change_ref: 2026-06-18 - Prod demo: nwabueze@perblis.com as verified supplier
- notes: IDs — user `019ede63-eb70-752c-be3e-522af7540bf8`, yard `019edeed-c9f9-7285-b29c-b1e16e41bebb`, listing `019edeed-cac2-7e05-99ea-44f83645355b`, duplicate `019edeed-d049-7bef-a2f7-37ff55aeaf50`. Solo pin (1 listing at yard) — yard aggregation kicks in at ≥2 Live listings per yard. Primary prod URL is now `api-production-101c8.up.railway.app` (old `perblisterminal-production` is stale/pre-Wave-3).

## 2026-06-18 15:50 - CHORE: prepare handoff for Wave 3 (Discovery)
- tag: CHORE
- area: Implementations.md, CLAUDE.md, docs/waves/README.md (docs-only)
- summary: Handoff prep so a fresh instance can resume cold into Wave 3. Reconciled docs to the code that actually shipped: Waves 0–2 are merged to `main` and the backend is deployed; Wave 2's prod API E2E demo criterion was met; the Django admin "Terminal Ops Console" theme + the static-manifest 500 hotfix are merged and confirmed styled & live in prod. Refreshed the Implementations.md **Current status** block (built/deployed, Ops Console is visual-only, Wave 3 is the gated next wave with a "read docs/waves/wave-3.md first" pointer + carry-over gotchas), updated the CLAUDE.md repo-state snapshot, and set the docs/waves/README.md status column (Wave 2 ✅ done & merged; Wave 3 next, gated on explicit founder go).
- reason: Founder asked to "prepare the handoff for wave 3."
- change_ref: 2026-06-17 15:35 - FIX: admin 500 in prod — bake static manifest at build + leading-slash STATIC_URL
- notes: Docs-only, no behavior change. **No OpenAPI regeneration** — nothing since Wave 2's contract freeze touched an API contract (the admin theme + static fix are non-API). Wave gating is binding: this handoff does NOT authorize Wave 3 — the next instance must confirm explicit founder approval (and record Wave 2 sign-off) before coding. New-instance reading path verified: Implementations.md → design.md → docs/waves/wave-3.md → FSD §6 / TSD §3.1, §3.7, §3.8. Opening a docs-only draft PR with this.

## 2026-06-18 22:50 - DECISION: Wave 2 sign-off + Wave 3 (Discovery) approved to build
- tag: DECISION
- area: wave gating
- summary: Founder gave explicit go to start Wave 3 (Discovery — Map Search & Yard Aggregation). Wave 2 is signed off (merged, deployed, prod E2E demo passed). Wave 3 builds the `search` app as 4 vertical slices: (1) `search/map` server-side yard aggregation, (2) `search/list` + cursor pagination + group_by, (3) LocationIQ `geocode` proxy w/ 24h cache, (4) performance pass (~500-listing seed, EXPLAIN ANALYZE, P95<500ms). Contracts (`search/map`, `search/list`, `geocode`) freeze at wave end.
- reason: D-gate: "never start the next wave without explicit founder approval." Approval recorded here per the handoff note's requirement.
- change_ref: 2026-06-18 15:50 - CHORE: prepare handoff for Wave 3 (Discovery)
- notes: Slice loop does not authorize Wave 4 — that needs its own founder go.

## 2026-06-18 22:55 - Wave 3 Slice 1: map search & yard aggregation
- tag: FEATURE
- area: backend/search (services/aggregation.py, serializers.py, views.py, urls.py, tests/test_map_search.py), backend/listings/spec_data.py (star_field helper), backend/core/urls.py (mount search), backend/.github/workflows/backend.yml (mypy +search), backend/openapi/schema.yml
- summary: Wave 3 §3.1 / TSD §3.7. `GET /api/v1/search/map` — anonymous-allowed (throttle `search_anon` 60/min), params `bbox` XOR `lat,lng,radius_km` (+ `asset_class`, `q`, `price_min/max`, `spec_min/max`). Server-side aggregation over Live, visible (non-suspended/-deleted supplier, FSD §5.3) listings in the viewport: a yard with ≥2 Live listings → one `yards[]` entry (authoritative `listing_count`/`matching_count`, `class_mix`, `price_from`(+display), `supplier{id,name,logo,badge}`, embedded listing summaries); yardless or lone-at-yard listings → solo `listings[]` pins (with `distance_km`). Counts computed over the viewport-bounded Live set regardless of content filters, so a zero-match yard still appears (`matching_count:0`, client dims). One indexed spatial query (bbox `point__intersects` envelope / radius `point__dwithin` geography) + select_related/prefetch — N+1-free (asserted ≤6 queries). `★` spec range filter targets the per-class filterable headline field via new `listings.spec_data.star_field()` (single source of truth). `available` stubbed True until Wave 4. Distance = ST_Distance/1000 rounded 0.1km, ordering nearest-first.
- reason: Wave 3 §3.1 — the map read model behind the hirer home screen.
- change_ref: 2026-06-18 22:50 - DECISION: Wave 3 approved
- notes: Green locally — 188 suite tests (29 in search) / 92.99% overall cov; search aggregation 97%, serializers+views 100%. ruff+format+mypy clean (search added to CI mypy), makemigrations clean (no model changes — star_field is pure logic, no schema touch). OpenAPI regenerated: +218 lines, 0 deletions (purely additive — Wave-2 frozen contracts untouched; search contracts freeze at wave end). Local test DB: PostGIS 3.4 on pg16 (docker unavailable in remote env) at postgis://postgres:postgres@localhost:5432/terminal. DECISION-pending (not blocking, revisit at wave freeze): solo-pin `badge` = listing trust tier (basic/verified/inspected); yard `supplier.badge` = account verification badge — two distinct "badge" meanings, documented in aggregation.py. Next: Slice 2 — `search/list` (cursor pagination + group_by=asset|location).

## 2026-06-19 04:40 - Wave 3 Slice 2: search/list (cursor pagination + group_by)
- tag: FEATURE
- area: backend/search (services/common.py [new, shared primitives], services/aggregation.py [refactored onto common], services/listing.py [new], pagination.py [new keyset cursor], serializers.py [+List* shapes], views.py [+ListSearchView], urls.py [+search/list], tests/test_list_search.py [new]), backend/openapi/schema.yml
- summary: Wave 3 §3.2 / TSD §3.2. `GET /api/v1/search/list` — same params as `search/map` + `group_by` + cursor pagination; anon, `search_anon` throttle. `group_by=asset` (default): flat distance-ordered matching listings, each with `more_at_yard` (sibling matching listings at the same yard) for "+N more at this yard" sub-lines. `group_by=location`: yard cards (≥2 matching listings) interleaved with solo listings, ordered by distance. Unlike the map the list is filtered (no zero-match dimming). Extracted Slice-1's spatial/base-queryset/match/summary helpers into `search/services/common.py`; `aggregation.py` (map) now rides on them (map response shape byte-identical — schema diff confirms). New `search/pagination.py` = true keyset cursor over `(distance_km, tiebreak_id)`, DRF-style `{results,next,previous}` opaque `?cursor=` envelope; boundaries are values not offsets → stable under inserts (tested: insert a nearer row mid-walk, page 2 neither duplicates nor skips). N+1-free (≤6 queries asserted, both modes).
- reason: Wave 3 §3.2 — the list view of the discovery result set.
- change_ref: 2026-06-18 22:55 - Wave 3 Slice 1: map search & yard aggregation
- notes: Green locally — 209 suite tests (16 new list + refactored map intact) / 93.46% overall; search modules 96–100%. ruff+format+mypy clean, makemigrations clean (no model changes), `.env.example` complete. OpenAPI regenerated: +114 lines, 0 deletions (additive; search/map unchanged, Wave-2 frozen contracts untouched). search/map + search/list contracts still freeze at WAVE END (not slice end). Same pending DECISION as Slice 1: solo/row `badge` = listing tier vs yard `supplier.badge` = account verification (documented in common.py). Next: Slice 3 — `GET /api/v1/geocode` LocationIQ proxy (24h cache, no Redis).

## 2026-06-19 05:10 - Wave 3 Slice 3: geocoding proxy
- tag: FEATURE
- area: backend/search (services/geocode.py [new], serializers.py [+Geocode* shapes], views.py [+GeocodeView], urls.py [+geocode], tests/test_geocode.py [new]), backend/openapi/schema.yml
- summary: Wave 3 §3.4 / TSD §3.8. `GET /api/v1/geocode?q=&limit=` — server-side LocationIQ forward-geocode proxy; the API key never reaches the client. Anonymous, `search_anon` throttle (reusing the documented anon-search rate; no new throttle invented). Results cached 24h via Django's cache framework (LocMem dev / DB prod — no Redis, D-010); cache key = sha256(normalised-lowercased-query | limit). Nigeria-scoped (`countrycodes=ng`). Graceful degradation: when `LOCATIONIQ_KEY` is absent (dev/CI) or the upstream errors, returns 200 `{results: []}` with `provider_configured` flag — transient failures are NOT cached (re-fetched next call). Response: `{query, provider_configured, results:[{display_name, lat, lng}]}`. Mounted at `/api/v1/geocode` (not under search/) per TSD §3.8 misc group.
- reason: Wave 3 §3.4 — address→coords for the map/list pickers and listing-creation location step.
- change_ref: 2026-06-19 04:40 - Wave 3 Slice 2: search/list
- notes: Green locally — 221 suite tests (12 new geocode) / 93.56% overall; geocode service 98%, views+serializers 100%. ruff+format+mypy clean, makemigrations clean, `.env.example` complete (LOCATIONIQ_KEY already documented — no env change). OpenAPI regenerated: +65 lines, 0 deletions (additive). Mandatory checks covered: key never in response, cache-hit on repeat query (upstream called once), limit forwarded, query normalised for cache, unconfigured/failure degrade. Next + LAST Wave 3 slice: Slice 4 — performance pass (~500-listing seed, EXPLAIN ANALYZE hot queries, P95<500ms) + then WAVE-END contract freeze (search/map, search/list, geocode) and the badge-meaning DECISION resolution.

## 2026-06-19 05:35 - Wave 3 Slice 4: performance pass (wave build complete)
- tag: FEATURE
- area: backend/search (management/commands/seed_search_demo.py [new], tests/test_performance.py [new]), docs/waves/README.md (status)
- summary: Wave 3 §3.5 — closes the wave build. New `seed_search_demo` management command seeds dual-corridor (Apapa + Lekki) demo data: N Live listings across yards + suppliers, all 5 asset classes with a numeric ★ headline spec, ~80% yard-attached (→ yard pins) / 20% solo, reproducible RNG, `--clear` (deletes in dependency order — listing→yard FK is PROTECT). Verified GIST spatial indexes already exist on listings.point + yards.point (GeoDjango spatial_index default; no migration needed). Committed guardrail tests assert query count stays CONSTANT (≤6) at 150 listings — no N+1 at scale (latency itself is measured out-of-band, too noisy to gate in CI).
- reason: Wave 3 §3.5 — prove the discovery endpoints hold P95<500ms and are N+1-free under realistic data.
- change_ref: 2026-06-19 05:10 - Wave 3 Slice 3: geocoding proxy
- notes: **P95 measurement (local, 500 seeded listings, 60 reqs/endpoint, throttle disabled for the bench):** map(no filter) p50 97ms / **p95 173ms**; map(class+spec) p95 165ms; list asset p95 166ms; list location p95 180ms — all well under the 500ms gate (>2.5x margin; Railway differs but ample headroom). **EXPLAIN ANALYZE** of the hot bbox query: single query joining supplier/profile/yard, **Execution Time 3.5ms** — the ~95ms endpoint cost is Python serialization of the in-viewport rows, not the DB (GIST index present and used when the viewport is selective). Green locally — 226 suite tests (5 new) / 93.71% overall; seed command 100%, all search modules 96–100%. ruff+format+mypy clean, makemigrations clean, `.env.example` complete, OpenAPI unchanged (no new contract). **WAVE-END status:** build complete on PR #25 (Slices 3+4). Wave-end checklist — [x] FSD §6 acceptance tests, [x] P95 recorded (above), [x] OpenAPI committed + search contracts stable/frozen, [ ] founder demo + sign-off before Wave 4. DECISION resolved (documented, founder may override at demo): solo-pin/list-row `badge` = listing trust tier; yard `supplier.badge` = account verification badge. Founder demo path: deploy, `manage.py seed_search_demo --listings 500`, then exercise `/api/v1/search/map` for the four canonical cases + `/search/list` + `/geocode`.

## 2026-06-19 06:05 (local) - Railway deploy to natural-cat project
- tag: DEPLOY
- area: Railway project natural-cat (7752aace-34c8-4ae6-928b-06ded98fb25a); services PostGIS + api + worker; backend/railway.json, backend/railway.worker.json
- summary: Brought up full backend stack on the **natural-cat** Railway project via CLI (MCP list_projects worked; deeper MCP calls returned Unauthorized — used linked `railway` CLI instead). PostGIS was already online. Created **api** and **worker** empty services; configured root directory `backend`, Dockerfile builder, env vars (DATABASE_URL → `${{PostGIS.*}}` reference, all founder-provided keys), api healthcheck `/healthz`, worker `configFile=/backend/railway.worker.json` (required because `railway.json` startCommand overrides dashboard). Deployed both via `railway up`. Public API domain: **https://api-production-101c8.up.railway.app**. Probes green: `/healthz` database ok; `/readyz` database/r2/resend/termii/ably configured, bachs not_configured (empty keys). Migrations applied; superuser `nwabueze@perblis.com` seeded. Worker confirmed running `db_worker` (`queues=default`).
- reason: Founder requested Railway MCP setup + deploy on natural-cat with supplied production env vars.
- notes: Update `CORS_ALLOWED_ORIGINS` when the portal Workers URL is known. Set `LOCATIONIQ_KEY` for geocode. Bachs keys empty (Wave 4). Railway MCP may need `railway login` refresh in Cursor for full MCP access. Admin: https://api-production-101c8.up.railway.app/admin/

## 2026-06-19 06:20 (local) - GitHub auto-deploy on main (natural-cat)
- tag: CHORE
- area: Railway natural-cat; api + worker services
- summary: Connected both **api** and **worker** to `Perblis/Perblis_Terminal` branch **main** with root directory `backend` (worker keeps `configFile=/backend/railway.worker.json`, `checkSuites=false`). Merges/pushes to `main` now trigger Railway builds for both services.
- reason: Founder requested GitHub auto-deploy on merge to main.
- change_ref: 2026-06-19 06:05 (local) - Railway deploy to natural-cat project
- notes: Requires Railway GitHub App authorized for the `Perblis` org/repo — if deploys don't fire after merge, install/approve at https://railway.com/account/integrations

## 2026-06-19 06:00 - Wave 3 demo run + Wave 4 handoff (docs-only)
- tag: CHORE
- area: Implementations.md, CLAUDE.md, docs/waves/README.md (docs-only)
- summary: Founder asked for a demo run + Wave 4 handoff. Ran the Wave 3 exit-criterion demo locally against 500 seeded dual-corridor listings (`seed_search_demo --listings 500`): all four canonical map cases verified — (1) yard pin with counts + supplier block + embedded summaries (Demo Yard 7, listing_count 25), (2) solo pin with distance_km + badge, (3) filter-aware matching_count (partial 3-of-20) AND dimmed zero-match yards (impossible ★-spec → 24 yards present, all matching_count 0, solos filtered to 0), (4) empty offshore viewport → `{yards:[],listings:[]}`; plus `search/list` asset (distance-ordered, more_at_yard, next cursor) + location (yard cards interleaved with solos) and `geocode` (graceful `provider_configured:false` in dev). Then refreshed the handoff docs: Implementations.md Current-status block (Waves 0–3 done/deployed; Wave 4 next + read-wave-4.md pointer + carry-overs incl. LOCATIONIQ_KEY-in-prod, badge meaning, available-stub→Wave 4), CLAUDE.md repo snapshot, docs/waves/README.md status column.
- reason: Founder: "demo run, pull latest code from git and then do the wave 4 handoff."
- change_ref: 2026-06-19 05:35 - Wave 3 Slice 4: performance pass (wave build complete)
- notes: Docs-only, no behavior change; no OpenAPI regeneration (search contracts already committed/frozen at Slice 4). Pulled latest `main` (9a72cfd — incl. the natural-cat Railway bring-up + main→Railway auto-deploy, so Wave 3 is live in prod once #25's merge built). Wave gating remains binding: this handoff is NOT Wave 4 authorization — the next instance must record explicit founder go (+ Wave 3 sign-off) before coding `hires`/`payments`. New-instance reading path: Implementations.md → design.md → docs/waves/wave-4.md → FSD §3/§7/§9 + TSD §3.2–§3.6. Opening a docs-only draft PR.

## 2026-06-19 - Wave 4 authorized (founder go) + Slice 4A: fee engine
- tag: DECISION
- area: wave gating
- summary: Founder gave explicit approval to start **Wave 4 (Hires & Money)** ("let's start wave 4"). Recording the Wave 3 sign-off (exit criterion demonstrated — see prior demo entry) and Wave 4 authorization together. Building per docs/waves/wave-4.md as six ordered slices (4A fee engine → 4B model/state/availability → 4C request/accept/decline → 4D Bachs payments → 4E timers/handovers/disputes → 4F payouts/reconciliation/notifications), each its own PR, 85% coverage gate on hires+payments. Naming default (flagged to founder): webhook-dedup table is provider-neutral `payment_events` (not TSD's `paystack_events`) since D-017 supersedes Paystack with Bachs.io.
- reason: Founder authorization; wave gating is binding (CLAUDE.md / design.md §7).
- change_ref: 2026-06-19 06:00 - Wave 3 demo run + Wave 4 handoff (docs-only)
- notes: Wave-4.md/TSD text still says "Paystack" — treat as Bachs.io per D-017 (HMAC-SHA256 hex, decimal-naira strings at the adapter boundary only).

## 2026-06-19 - Wave 4 Slice 4A: fee engine (hires/fees.py, pure)
- tag: FEATURE
- area: backend/hires (fees.py [new], enums.py [new — Scheme], tests/test_fees.py [new])
- summary: FSD §3.1 / TSD §3.2 fee engine, pure (no I/O, no ORM, no clock). Integer per-mille `RATE_TABLE` by (asset class, scheme); `FEE_FLOOR = 250_000` kobo (₦2,500). `quote(asset_class, *, days, daily_price, weekly_price?, monthly_price?) -> FeeQuote(hire_value, service_fee, payout_amount, fee_basis, scheme)`: best-price over only the set schemes (`min(daily×d, weekly×ceil(d/7), monthly×ceil(d/30))`, D-008), ties → longer scheme; `service_fee = max(value×rate//1000, FEE_FLOOR)` (D-002); `payout = value − fee` (D-005); `fee_basis` e.g. "10% weekly (min ₦2,500)". `duration_days(start,end) = (end−start).days+1` inclusive. Money is integer kobo throughout; rates as ‰ so no float/Decimal ever.
- reason: Wave 4 slice 4A — the locked-at-acceptance financial truth every downstream slice depends on.
- change_ref: 2026-06-19 - Wave 4 authorized (founder go)
- notes: Green — the **five FSD §3.1 worked examples are named test vectors** (₦240k/₦28,800; ₦900k/₦90,000; ₦640k/₦76,800; ₦15k→₦2,500 floor; ₦350k/₦21,000), all pass byte-exact; + hypothesis properties (accounting identity payout+fee≡value, floor honoured, monotonic-in-days, best-price optimality) + tie-break + guard rejects. 16 tests, **hires.fees + hires.enums at 100%** coverage. ruff+format+mypy clean (TextChoices members are `tuple[str,str]` to mypy without django-stubs → tables keyed by `str(member)`; fee_basis built from the scheme code word, no `.label`). No models/migrations yet (4B). Next: Slice 4B — Hire model + state machine + availability engine.

## 2026-06-19 - Wave 4 Slice 4B (part 1): Hire model + state machine + availability engine
- tag: FEATURE
- area: backend/hires (models.py, enums.py [+HireStatus/ActorKind/CancelledBy/HandoverKind], errors.py, availability.py, state.py, factories.py, migrations/0001_initial.py, tests/{test_availability,test_state,test_race}.py)
- summary: TSD §3.3/§3.4/§3.5, FSD §7.3. Models: `Hire` (financials locked@accept; hot-path index (listing,status,start,end) + (hirer,status) + (supplier,status)), `HireEvent` (append-only — `save` rejects updates, `delete` forbidden at model layer + migration `REVOKE UPDATE,DELETE` for restricted prod roles), `HandoverRecord` (model now; logic in 4E). State machine `state.apply(hire, action, *, actor, actor_kind, **meta)` is the SOLE writer of `Hire.status` — 7-state TRANSITIONS table (accept/decline/expire/pay/cancel/start/complete/dispute/resolve_*), each writes a HireEvent + `transaction.on_commit` side-effect hook (notifications stubbed → 4D/4F). Availability engine (TSD §3.4): **two checks** — public/soft (`is_available`/`free_units`: confirmed+on_hire+accepted-live, for search/date-picker/new requests) and hard (`can_confirm`: confirmed+on_hire only, for accept/pay). Binding race rule: accept+pay take `SELECT … FOR UPDATE` on the listing row then re-check `can_confirm`; on Confirmed the same txn auto-cancels overflowed Requested/Accepted competitors (`no_longer_available`). Supplier may **oversell** at accept (soft holds); **first-to-pay wins**.
- reason: Wave 4 slice 4B — the hire lifecycle + capacity engine the money loop runs on.
- change_ref: 2026-06-19 - Wave 4 Slice 4A: fee engine
- notes: Green — 47 hires tests (full suite 273 pass), **hires at 98%** coverage (availability/enums/errors/factories/fees 100%, state 97%, models 95%). The **threaded double-payment race test** (`test_race.py`, django_db(transaction=True)) confirms exactly one Confirmed on the last unit + loser bumped; stable across 5 reruns. ruff+format+mypy clean (14 files); makemigrations --check clean; migration 0001 reversible. **Modeling note (resolved):** FSD §7.3's "auto-decline overflowed Requested/**Accepted** on Confirm" + "first-to-pay wins" only cohere if accept permits oversell — so accept/pay gate on *hard* holds (can_confirm), while *public* availability counts soft holds. Documented in availability.py. **Still in 4B (next commit):** wire real availability into search payloads (`available` flag + yard "n of m free") via a BULK hold-count (respect search's ≤6-query gate) + remove the stub note from search OpenAPI. Then 4C (request/accept/decline APIs).

## 2026-06-19 - Wave 4 Slice 4B (part 2): close the Wave 3 `available` stub
- tag: FEATURE
- area: backend/hires/availability.py (+availability_map), backend/search/services/{common,aggregation,listing}.py, backend/search/serializers.py, backend/search/tests/test_availability_flag.py [new], backend/openapi/schema.yml
- summary: Wired the real availability engine into search, closing the Wave 3 stub (`available` was hardcoded `true`). New `availability.availability_map(listings)` returns `{id: available_now}` in **one** grouped aggregate query (soft holds covering today vs unit_count). `common.annotate_availability(listings)` tags each listing `_available`; both summary builders now read it; both service entry points (search_map, _matching_listings) call it. So map pins, list rows, and yard-embedded summaries all carry a truthful `available` — and the per-listing flags in a yard's embedded `listings[]` are exactly the "n of m free" caption data (ux/02 S5), no new aggregate field needed. Serializer help_text updated; OpenAPI regenerated (description-only, contract shape unchanged).
- reason: Wave 4 §4B — discovery must reflect real capacity once hires exist.
- change_ref: 2026-06-19 - Wave 4 Slice 4B (part 1)
- notes: Green — 276 tests (3 new: no-hold→available, fully-held→unavailable, multi-unit partial→available). search perf gate still holds (≤6 queries — the bulk availability query fit the budget). ruff+format+mypy clean (34 files). `available` semantics: free *now* (today) against soft holds (confirmed+on_hire+accepted-live); date-range availability is enforced at request/accept (4C) + pay (4D). **Slice 4B complete.** Next: Slice 4C — POST hires (preview via 4A, D-014 total-only, Basic ₦250k cap, blocked-date validation), accept/decline/cancel APIs + role-shaped hire serializers (D-014 tested both directions).
