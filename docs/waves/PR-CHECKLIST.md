# PR Checklist

Every PR in every wave satisfies this. It is the operational form of the Definition of Done
in [design.md](../../design.md) §6 — that section stays authoritative; this file is the
tick-list you work through. A slice is not done until every applicable box holds **and** the
suite is green.

## Scope and authority

- [ ] The work sits inside a wave whose approval is recorded as in progress in
      [README.md](README.md). Finishing one wave never authorizes the next.
- [ ] The behaviour implemented matches the canonical FSD section it claims to implement, and
      that section's **Acceptance checks** are covered.
- [ ] No ratified decision was re-litigated. A genuine conflict was surfaced as a
      `DECISIONS.md` entry rather than improvised around.
- [ ] The slice stands alone — it clears this checklist on its own, not jointly with a
      later slice.

## Naming and lexicon

- [ ] Lexicon-clean in **code identifiers, API fields, DB columns, comments and UI copy**:
      Supplier/Hirer (never owner/renter), Hire (never booking), Yard, Live, On Hire,
      Service Fee.
- [ ] `grep -riE "renter|\bbooking\b|owner"` finds nothing new (approved names like
      `parent_hire` excepted).

## Money and state

- [ ] Money is integer kobo in `BigIntegerField` through `core.money` — no floats, no
      Decimals in domain logic, naira never stored.
- [ ] No locked-field mutation: `hire_value`, `service_fee`, `payout_amount`, `fee_basis`
      are untouched after the accept transition.
- [ ] **No D-014 leak** — no `service_fee` or `payout_amount` in any hirer-facing
      serializer, screen, email or receipt, asserted by test.
- [ ] Every status change goes through `hires/state.py::apply()` (or `listings/state.py` for
      listings) and writes its append-only event. No `.status =` assignment anywhere else.
- [ ] Capacity-consuming writes take `SELECT FOR UPDATE` on the listing row, re-check
      availability, then write — in one transaction, with side-effects on
      `transaction.on_commit`.
- [ ] Business logic lives in services, not in views, serializers or signals.

## Tests

- [ ] Money and state-machine paths have explicit tests; illegal transitions are covered,
      not just legal ones.
- [ ] Coverage gates hold: **85%** on `hires` and `payments`, **70%** overall
      (`pytest --cov`).
- [ ] Webhook paths are tested for duplicate, out-of-order and replayed delivery; sweeps are
      tested idempotent by double-run.
- [ ] `ruff check .` and `ruff format .` are clean; the portal passes eslint, `tsc` and its
      build.

## Contracts and migrations

- [ ] If a contract changed, OpenAPI was **regenerated and committed**
      (`backend/openapi/schema.yml`).
- [ ] **No wave-frozen contract was broken.** If one had to change, founder sign-off is
      recorded in the PR.
- [ ] Migrations are reversible and run clean both directions.
- [ ] `.env.example` is exhaustive for anything new.

## Security and operations

- [ ] No secret in code, config, fixture or transcript; new env vars are documented.
- [ ] Private media stays private — presigned GETs minted only where access is already
      enforced.
- [ ] Missing dev keys degrade to a log or console fallback. **Nothing auto-verifies a user
      or auto-pays a hire in any environment.**
- [ ] New failure paths carry Sentry context.

## Design

- [ ] Colours, type and spacing come only from `packages/tokens` — no literal hex or px in
      components.
- [ ] All seven data states are designed, not defaulted: loading, empty, error, partial,
      dense, overflow, offline.

## Record

- [ ] An `Implementations.md` entry is appended in the standard format, including
      follow-ups and blockers.
- [ ] If wave status changed, [README.md](README.md) was updated — it is the only place
      status is tracked.
