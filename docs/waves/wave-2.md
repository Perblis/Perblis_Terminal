# Wave 2 — Supply: Profiles, Yards, Spec Templates, Listings

**Status:** ⏸ Gated on Wave 1 sign-off
**Depends on:** Wave 1 (auth, account levels, verification)
**Spec references:** FSD §5 (yards, listings, storefronts — incl. Acceptance checks) · TSD §3.1 (`suppliers`, `listings`), §3.3 (`supplier_profiles`, `yards`, `spec_templates`, `listings`, `listing_photos`, `units`, `reports`), §3.9 (media pipeline) · doc 05 (Asset Spec Schemas — **normative seed source**) · DECISIONS D-013 (pin-drop-first location UX)

## Objective

A verified supplier can build their entire supply presence through the API: business profile with encrypted bank details, named yards with geographic pins, spec-templated listings with photos, publish gates enforced, fleet ergonomics (duplicate, unit_count) working, and a public storefront readable. After this wave, real supply can exist in the system — which is exactly what Wave 3 will search over.

## In scope

### 2.1 Supplier profile (`suppliers`)
- `GET/PATCH suppliers/me/profile` — business name, description, logo (presign); bank name, **bank account number Fernet-encrypted at rest** (`FIELD_ENCRYPTION_KEY`), account name; per-type notification prefs (4 booleans, default ON); `strike_count` read-only.
- Business-profile completeness is the supplier-activation gate: no listing may go **Live** until profile complete **and** user is Verified (FSD §4.1 + §5).

### 2.2 Yards (FSD §5.1)
- `GET/POST yards` · `PATCH/DELETE yards/:id` — name, `geography(Point,4326)` pin, address text, city. **A yard with listings cannot be deleted** (rename/move only — stable error code `yard_has_listings`).
- Listings attach to 0..1 yard, **denorm-inherit its coordinates**; moving a listing between yards updates `listings.point` immediately. Auto-yard inference (new pin within 100m of an existing yard ⇒ flag in response so clients can prompt "Add to {yard}?").

### 2.3 Spec templates (doc 05 → data migration)
- `spec_templates` seeded by data migration from doc 05: every launch class+type (~35), field defs jsonb (kinds: number/text/select/multi/boolean + units), versioned, uniq(class, type, version). Management command `seed_spec_templates` idempotent.
- `GET spec-templates?class=&type=` for clients. ★ headline spec per class flagged in the template (operating_weight · payload_capacity · floor_area · container_capacity TEU · area).
- Server-side validation of `listings.specs` jsonb against the template (required fields, types, select options); `spec_template_version` stamped on the listing.

### 2.4 Listings (FSD §5.2)
- `GET/POST listings` (mine) · `GET listings/:id` (public iff Live) · `PATCH listings/:id`.
- Fields per TSD §3.3 `listings` row. Pricing: **daily ₦ required**; weekly/monthly optional (kobo, integers); `unit_count ≥ 1`; optional per-unit labels (`units` table). "Other" asset type routes to Ops review.
- **Status actions** `POST :id/publish|pause|archive|duplicate`: Draft → Live ⇄ Paused → Archived; Removed is Ops-only (Wave 6 surface; model + reason field now). Archived/Removed preserve hire history; hard delete forbidden once hires exist (DB-level PROTECT).
- **Publish gates** (FSD §5.2 acceptance): daily price set · ≥1 photo · valid location (yard chip OR own pin OR geocoded address) · all required template specs · supplier Verified + business profile complete. Each failure a stable error code (`publish_requires_photo`, …).
- **Duplicate Listing** creates a new Draft copying class/type, specs, pricing, unit data, and yard; photo copy is optional per `ux/01` F9 (when copied, photos reference the same R2 objects — no re-upload). Tier resets to Basic (tiers are per-listing, auto-Basic at publish).
- Completeness score computed and stored (not user-visible in MVP).
- Tiers: Basic auto at publish; Verified/Inspected are Ops-awarded (Wave 6 action; field now).

### 2.5 Media pipeline (TSD §3.9 — first consumer)
- `POST media/presign` — kind-scoped (`listing_photo`/`avatar`/`logo`/`verification_doc`/`handover_photo`), content-type + size validated, returns key + presigned PUT. Public vs private bucket by kind.
- `POST listings/:id/photos` attach (≤10 enforced in service) · `PATCH :id/photos/order` (positions + cover). Weekly R2 orphan sweep task (unattached keys >7 days).

### 2.6 Reports & storefronts
- `POST listings/:id/reports` — authenticated hirers; reason enum (fraudulent/inaccurate/inappropriate/duplicate/unavailable); throttle 5/day/user; **never auto-hides**; 3 reports in 30 days sets the priority-review flag (tested).
- `GET storefronts/:supplier_id` (public): logo, name, badge, member-since, about, yards (as mini-map data), Live listings with class filter. **No hire CTA** — and suspended supplier ⇒ storefront 404s along with listings hidden (FSD §5.3).

## Out of scope (deferred)

- Search/map endpoints (Wave 3) · availability (Wave 4) · enquiry messaging from storefront (Wave 5) · Ops tier-award/remove UX (Wave 6) · video verification & inspections (Phase 3).

## Contracts frozen at wave end

`suppliers/*`, `yards/*`, `listings/*`, `spec-templates`, `storefronts/:id`, `media/presign` — Wave 7's portal asset-management screens build directly on this freeze.

## Mandatory tests

- Publish-gate matrix: each missing precondition → its stable error code; all present → Live.
- Spec validation against templates incl. version stamping; ★ field present per class.
- Bank number encrypted at rest (raw DB read shows ciphertext); never serialized unmasked (masked display per FSD §10.2 settings).
- Yard-with-listings delete blocked; listing yard-move updates denormed point; 100m inference flag.
- Photo cap (10), reorder, cover; presign rejects wrong kind/content-type/size.
- Report throttle + 3-in-30-days priority flag (freezegun).
- Live edit never mutates anything hire-locked (guard exists even though hires arrive Wave 4 — assert pricing edits don't cascade).
- Lexicon sweep clean.

## Exit criterion (founder demo)

> Via the production API: a Verified supplier completes their business profile, creates a yard, creates a listing through all six steps (template specs enforced), uploads photos via presigned PUT, publishes it Live, duplicates it for a second unit-rich listing — and `GET storefronts/:id` shows the company page with both listings. An unverified supplier attempting publish gets `verification_required`.

## Wave-end checklist

- [ ] FSD §5.2/§5.3 acceptance checks pass as named tests
- [ ] `seed_spec_templates` run in prod; ~35 templates live
- [ ] OpenAPI regenerated & committed
- [ ] Founder approval recorded before Wave 3 begins
