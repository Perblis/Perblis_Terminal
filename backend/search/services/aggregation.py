"""Server-side map search & yard aggregation (FSD §6, TSD §3.7).

The read model behind the hirer's home map. Given a viewport (``bbox``) or a
radius, return Live listings grouped **server-side** into:

* **yards** — a yard with ≥2 Live listings becomes one aggregated pin carrying
  authoritative ``listing_count`` / ``matching_count``, ``class_mix``,
  ``price_from`` and embedded listing summaries (so the Yard Sheet opens with
  zero extra round-trips, Fleet E4); and
* **listings** — solo pins: a yardless listing, or the lone Live listing at a
  yard.

All counting, distance and filtering is server-authoritative — clients only
style and spatially cluster what they're given (TSD §3.7).

Counts are computed over the **viewport-bounded Live set** regardless of the
content filters, so a yard with no matches under an active filter still appears
with ``matching_count: 0`` (the client dims it, never removes it — FSD §6).
That set has to be scanned to decide yard membership anyway, so matching is
evaluated in Python over the already-loaded rows rather than in a second query
— keeping the endpoint a single indexed spatial query (N+1-free).

Shared primitives (spatial filter, base queryset, match predicate, summary
shapes) live in ``search.services.common``.
"""

from __future__ import annotations

from listings.models import Listing
from listings.spec_data import star_field
from search.services import common


def _yard_entry(group: list[Listing], params: dict, star: str | None) -> dict:
    yard = group[0].yard
    prices = [ln.daily_price for ln in group]
    matching = sum(1 for ln in group if common.matches(ln, params, star))
    return {
        "yard_id": str(yard.id),
        "name": yard.name,
        "point": common.point_geojson(yard.point),
        "supplier": common.supplier_block(group[0].supplier),
        "listing_count": len(group),
        "matching_count": matching,
        "class_mix": common.class_mix(group),
        "price_from": min(prices),
        "price_from_display": common.display(min(prices)),
        "listings": [common.embedded_summary(ln) for ln in group],
        # Internal: nearest listing in the yard, for stable distance ordering.
        "_distance_km": min(common.distance_km(ln) for ln in group),
    }


def search_map(params: dict) -> dict:
    """Aggregate Live listings in the area into yard pins + solo pins (TSD §3.7)."""
    star = star_field(params["asset_class"]) if params.get("asset_class") else None
    listings = list(common.base_listings(params)[0])

    # First pass: Live listings per real yard, to decide yard pin vs. solo pin.
    yard_counts: dict = {}
    for ln in listings:
        if ln.yard_id is not None:
            yard_counts[ln.yard_id] = yard_counts.get(ln.yard_id, 0) + 1

    yard_groups: dict = {}
    solo: list[Listing] = []
    for ln in listings:
        if ln.yard_id is not None and yard_counts[ln.yard_id] >= common.YARD_MIN_LISTINGS:
            yard_groups.setdefault(ln.yard_id, []).append(ln)
        else:
            solo.append(ln)

    yards_out = [_yard_entry(group, params, star) for group in yard_groups.values()]
    yards_out.sort(key=lambda y: (y["_distance_km"], y["yard_id"]))
    for entry in yards_out:
        entry.pop("_distance_km", None)

    # Solo pins are filtered (no dimming concept for a single listing); yard
    # pins persist with matching_count 0 so the client can dim them.
    solo_out = [common.listing_summary(ln) for ln in solo if common.matches(ln, params, star)]
    solo_out.sort(key=lambda s: (s["distance_km"], s["id"]))

    return {"yards": yards_out, "listings": solo_out}
