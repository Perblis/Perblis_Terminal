"""Search results in list form (FSD §6, TSD §3.7 §3.2).

``GET /api/v1/search/list`` returns the same result set as the map, ordered by
distance for a scrollable list, in one of two groupings:

* ``asset`` (default) — a flat list of matching listings, each annotated with
  ``more_at_yard`` (other matching listings at the same yard) so the client can
  render "+N more at this yard" sub-lines.
* ``location`` — yard cards (≥2 matching listings at a yard) interleaved with
  solo listings, every item ordered by distance.

Unlike the map, the list is **filtered** (no zero-match dimming) — a results
list shows only what matches. The viewport-bounded matching set is scanned in
Python (reusing ``search.services.common``); the view then keyset-paginates the
ordered items (``search.pagination``).
"""

from __future__ import annotations

from collections import Counter, defaultdict

from listings.models import Listing
from listings.spec_data import star_field
from search.services import common

GROUP_ASSET = "asset"
GROUP_LOCATION = "location"


def _matching_listings(params: dict) -> list[Listing]:
    star = star_field(params["asset_class"]) if params.get("asset_class") else None
    listings = [ln for ln in common.base_listings(params)[0] if common.matches(ln, params, star)]
    common.annotate_availability(listings, params)
    return listings


def _asset_items(listings: list[Listing]) -> list[dict]:
    per_yard = Counter(ln.yard_id for ln in listings if ln.yard_id is not None)
    items = []
    for ln in listings:
        more = per_yard[ln.yard_id] - 1 if ln.yard_id is not None else 0
        items.append(
            {
                **common.listing_summary(ln),
                "yard_id": str(ln.yard_id) if ln.yard_id is not None else None,
                "more_at_yard": more,
                "_key": (common.distance_km(ln), str(ln.id)),
            }
        )
    items.sort(key=lambda i: i["_key"])
    return items


def _yard_card(group: list[Listing]) -> dict:
    yard = group[0].yard
    prices = [ln.daily_price for ln in group]
    distance = min(common.distance_km(ln) for ln in group)
    return {
        "type": "yard",
        "yard_id": str(yard.id),
        "name": yard.name,
        "point": common.point_geojson(yard.point),
        "supplier": common.supplier_block(group[0].supplier),
        "listing_count": len(group),
        "class_mix": common.class_mix(group),
        "price_from": min(prices),
        "price_from_display": common.display(min(prices)),
        "distance_km": distance,
        "listings": [common.embedded_summary(ln) for ln in group],
        "_key": (distance, str(yard.id)),
    }


def _location_items(listings: list[Listing]) -> list[dict]:
    per_yard = Counter(ln.yard_id for ln in listings if ln.yard_id is not None)
    groups: dict = defaultdict(list)
    solo: list[Listing] = []
    for ln in listings:
        if ln.yard_id is not None and per_yard[ln.yard_id] >= common.YARD_MIN_LISTINGS:
            groups[ln.yard_id].append(ln)
        else:
            solo.append(ln)

    items = [_yard_card(group) for group in groups.values()]
    for ln in solo:
        items.append(
            {
                "type": "listing",
                **common.listing_summary(ln),
                "yard_id": str(ln.yard_id) if ln.yard_id is not None else None,
                "_key": (common.distance_km(ln), str(ln.id)),
            }
        )
    items.sort(key=lambda i: i["_key"])
    return items


def search_list(params: dict, group_by: str) -> list[dict]:
    """Ordered (by distance) list items for the requested grouping."""
    listings = _matching_listings(params)
    if group_by == GROUP_LOCATION:
        return _location_items(listings)
    return _asset_items(listings)
