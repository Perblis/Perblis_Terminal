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

Suspended/deleted suppliers' listings are excluded here exactly as they are
hidden from the storefront and listing detail (Wave 2, FSD §5.3).

``available`` is stubbed ``True`` until Wave 4's availability engine lands
(wave-3 out-of-scope; flagged in the schema).
"""

from __future__ import annotations

from django.contrib.gis.db.models.functions import Distance
from django.contrib.gis.geos import Point, Polygon
from django.contrib.gis.measure import D

from accounts.models import AccountLevel
from core import media
from core.money import display
from listings.enums import ListingStatus
from listings.models import Listing
from listings.spec_data import star_field
from suppliers.models import SupplierProfile

# Supplier verification badge — mirrors the storefront's mapping (FSD §5.3).
_BADGE = {
    AccountLevel.VERIFIED: "verified",
    AccountLevel.BUSINESS_VERIFIED: "business_verified",
}

# A yard pin is emitted only once a yard holds at least this many Live listings;
# below it the listing(s) render as solo pins (FSD §6 / TSD §3.7).
_YARD_MIN_LISTINGS = 2


def _point_geojson(point: Point | None) -> dict | None:
    if point is None:
        return None
    return {"type": "Point", "coordinates": [point.x, point.y]}


def _cover_url(listing: Listing) -> str:
    photos = list(listing.photos.all())
    cover = next((p for p in photos if p.is_cover), photos[0] if photos else None)
    return media.public_url(cover.r2_key) if cover else ""


def _supplier_block(user) -> dict:
    try:
        profile: SupplierProfile | None = user.supplier_profile
    except SupplierProfile.DoesNotExist:
        profile = None
    return {
        "id": str(user.id),
        "name": profile.business_name if profile else "",
        "logo": media.public_url(profile.logo_key) if profile and profile.logo_key else "",
        "badge": _BADGE.get(user.account_level),
    }


def _spatial(params: dict) -> tuple[Point, dict]:
    """Return ``(reference point for distance, queryset filter for the area)``.

    bbox uses ``&&``-style envelope intersection (GIST); radius uses
    ``ST_DWithin`` on the geography column (TSD §3.7).
    """
    bbox = params.get("bbox")
    if bbox is not None:
        min_lng, min_lat, max_lng, max_lat = bbox
        envelope = Polygon.from_bbox((min_lng, min_lat, max_lng, max_lat))
        envelope.srid = 4326
        ref = Point((min_lng + max_lng) / 2.0, (min_lat + max_lat) / 2.0, srid=4326)
        return ref, {"point__intersects": envelope}
    ref = Point(params["lng"], params["lat"], srid=4326)
    return ref, {"point__dwithin": (ref, D(km=params["radius_km"]))}


def _matches(listing: Listing, params: dict, star: str | None) -> bool:
    """Whether a listing passes the active content filters (the ``matching`` set)."""
    asset_class = params.get("asset_class")
    if asset_class and listing.asset_class != asset_class:
        return False

    q = params.get("q")
    if q:
        needle = q.lower()
        if needle not in listing.title.lower() and needle not in listing.description.lower():
            return False

    price = listing.daily_price
    if params.get("price_min") is not None and price < params["price_min"]:
        return False
    if params.get("price_max") is not None and price > params["price_max"]:
        return False

    spec_min = params.get("spec_min")
    spec_max = params.get("spec_max")
    if star and (spec_min is not None or spec_max is not None):
        value = listing.specs.get(star)
        if not isinstance(value, (int, float)) or isinstance(value, bool):
            return False
        if spec_min is not None and value < spec_min:
            return False
        if spec_max is not None and value > spec_max:
            return False
    return True


def _embedded_summary(listing: Listing) -> dict:
    return {
        "id": str(listing.id),
        "title": listing.title,
        "asset_class": listing.asset_class,
        "price_from": listing.daily_price,
        "price_from_display": display(listing.daily_price),
        "photo": _cover_url(listing),
        "available": True,  # stub until Wave 4 availability
    }


def _yard_entry(group: list[Listing], params: dict, star: str | None) -> dict:
    yard = group[0].yard
    prices = [ln.daily_price for ln in group]
    class_mix: list[str] = []
    for ln in group:
        if ln.asset_class not in class_mix:
            class_mix.append(ln.asset_class)
    matching = sum(1 for ln in group if _matches(ln, params, star))
    return {
        "yard_id": str(yard.id),
        "name": yard.name,
        "point": _point_geojson(yard.point),
        "supplier": _supplier_block(group[0].supplier),
        "listing_count": len(group),
        "matching_count": matching,
        "class_mix": class_mix,
        "price_from": min(prices),
        "price_from_display": display(min(prices)),
        "listings": [_embedded_summary(ln) for ln in group],
        # Internal: nearest listing in the yard, for stable distance ordering.
        "_distance_km": min(ln.distance.km for ln in group),
    }


def _solo_entry(listing: Listing) -> dict:
    return {
        "id": str(listing.id),
        "title": listing.title,
        "asset_class": listing.asset_class,
        "point": _point_geojson(listing.point),
        "price_from": listing.daily_price,
        "price_from_display": display(listing.daily_price),
        "distance_km": round(listing.distance.km, 1),
        "photo": _cover_url(listing),
        # The listing's own trust tier (basic/verified/inspected) — the map-pin
        # badge. The yard's ``supplier.badge`` carries the account verification.
        "badge": listing.tier,
        "available": True,  # stub until Wave 4 availability
    }


def search_map(params: dict) -> dict:
    """Aggregate Live listings in the area into yard pins + solo pins (TSD §3.7)."""
    ref, spatial = _spatial(params)
    star = star_field(params["asset_class"]) if params.get("asset_class") else None

    listings = list(
        Listing.objects.filter(
            status=ListingStatus.LIVE,
            supplier__suspended_at__isnull=True,
            supplier__deleted_at__isnull=True,
            point__isnull=False,
            **spatial,
        )
        .select_related("supplier", "supplier__supplier_profile", "yard")
        .prefetch_related("photos")
        .annotate(distance=Distance("point", ref))
    )

    # First pass: Live listings per real yard, to decide yard pin vs. solo pin.
    yard_counts: dict = {}
    for ln in listings:
        if ln.yard_id is not None:
            yard_counts[ln.yard_id] = yard_counts.get(ln.yard_id, 0) + 1

    yard_groups: dict = {}
    solo: list[Listing] = []
    for ln in listings:
        if ln.yard_id is not None and yard_counts[ln.yard_id] >= _YARD_MIN_LISTINGS:
            yard_groups.setdefault(ln.yard_id, []).append(ln)
        else:
            solo.append(ln)

    yards_out = [_yard_entry(group, params, star) for group in yard_groups.values()]
    yards_out.sort(key=lambda y: (y["_distance_km"], y["yard_id"]))
    for entry in yards_out:
        entry.pop("_distance_km", None)

    # Solo pins are filtered (no dimming concept for a single listing); yard
    # pins persist with matching_count 0 so the client can dim them.
    solo_out = [_solo_entry(ln) for ln in solo if _matches(ln, params, star)]
    solo_out.sort(key=lambda s: (s["distance_km"], s["id"]))

    return {"yards": yards_out, "listings": solo_out}
