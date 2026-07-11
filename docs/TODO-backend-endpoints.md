# TODO — additive backend endpoints awaiting founder review

Frontend work has been shipping against existing APIs; these are the additive
endpoints that would unlock the next step of each surface. None are blocking —
every current screen works without them. All are additive-only (no frozen
Wave 2–5 contract changes); each needs an OpenAPI regen when built.

## Proposed with the 2026-07-11 dashboard rebuild

1. **Yard-scoped hire stats** — `GET /api/v1/hires/stats?yard_id=…` (or a
   `by_yard` block on the existing response). Unlocks per-yard tabs on the
   portal dashboard so a multi-yard supplier can see which depot the action
   is at. Today the dashboard aggregates the whole account.

2. **Payout day-series** — e.g. `GET /api/v1/payments/payouts/series?days=30`
   returning `[{date, amount}]`. Unlocks the 30-day earnings sparkline on the
   portal dashboard and a trend chart on the new `/earnings` page. Today both
   show month totals only (from the payout summary).

## Carried over from the Wave 8 build (already in the founder-approval queue)

3. **Listing quote** — `GET /api/v1/listings/{id}/quote?start=…&end=…`
   returning the server-priced `hire_value` + scheme for a date range. The
   app's S7 review step currently shows a labelled *client estimate*
   (lib/pricing.ts mirror of fees.py) until submission returns server truth.

4. **Listing availability ranges** — booked/blocked date ranges for a
   listing so the S7 request calendar can strike unavailable dates instead
   of relying on the 409 `availability_conflict` race sheet.

5. **`sort=price` on `GET /api/v1/search/list`** — S12 ships distance-only
   ordering; a price sort is the most-requested missing control.

## Smaller niceties (noted, not queued)

- **Handover photo display URLs** — `HandoverSerializer.photos` returns raw
  R2 keys; both clients resolve them through the public-media proxy. A
  `photos_display` field would remove client-side key handling. Works fine
  as-is since `handovers/` is a public-bucket prefix.
- **Server-side hires/listings filtering + pagination for the portal** — the
  portal walks all cursor pages to a 2000-item guard and filters client-side.
  Fine for MVP fleet sizes; revisit before large suppliers onboard.
