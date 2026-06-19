"""Shared building blocks for the search read endpoints (FSD §6, TSD §3.7).

The map (``aggregation.py``) and list (``listing.py``) endpoints draw on the
same primitives: the viewport/radius spatial filter, the Live-and-visible base
queryset, the content-filter predicate, and the per-listing/yard summary
shapes. They live here so both stay byte-for-byte consistent on what counts as
a match, what a pin/card looks like, and how distance is measured.
"""

from __future__ import annotations

from django.contrib.gis.db.models.functions import Distance
from django.contrib.gis.geos import Point, Polygon
from django.contrib.gis.measure import D
from django.db.models import QuerySet

from accounts.models import AccountLevel
from core import media
from core.money import display
from hires.availability import availability_map
from listings.enums import ListingStatus
from listings.models import Listing
from suppliers.models import SupplierProfile

# Supplier verification badge — mirrors the storefront's mapping (FSD §5.3).
_BADGE = {
    AccountLevel.VERIFIED: "verified",
    AccountLevel.BUSINESS_VERIFIED: "business_verified",
}

# A yard groups (vs. solo pins) only once it holds at least this many listings
# (FSD §6 / TSD §3.7). On the map that's Live listings; in a filtered list it's
# matching listings.
YARD_MIN_LISTINGS = 2


def point_geojson(point: Point | None) -> dict | None:
    if point is None:
        return None
    return {"type": "Point", "coordinates": [point.x, point.y]}


def cover_url(listing: Listing) -> str:
    photos = list(listing.photos.all())
    cover = next((p for p in photos if p.is_cover), photos[0] if photos else None)
    return media.public_url(cover.r2_key) if cover else ""


def supplier_block(user) -> dict:
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


def spatial_filter(params: dict) -> tuple[Point, dict]:
    """``(reference point for distance, queryset filter for the area)``.

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


def base_listings(params: dict) -> tuple[QuerySet[Listing], Point]:
    """Live, visible listings in the viewport, distance-annotated (no content filters).

    Suspended/deleted suppliers are excluded exactly as on the storefront and
    listing detail (Wave 2, FSD §5.3). One indexed spatial query;
    ``select_related``/``prefetch_related`` keep callers N+1-free.
    """
    ref, spatial = spatial_filter(params)
    qs = (
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
    return qs, ref


def matches(listing: Listing, params: dict, star: str | None) -> bool:
    """Whether a listing passes the active content filters (asset_class/q/price/★)."""
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


def distance_km(listing: Listing) -> float:
    return round(listing.distance.km, 1)


def annotate_availability(listings: list[Listing]) -> None:
    """Tag each listing with ``_available`` via one bulk query (Wave 4, TSD §3.4).

    Read by the summary builders below; keeps the endpoints N+1-free. Listings
    with no current hold default to available.
    """
    avail = availability_map(listings)
    for listing in listings:
        listing._available = avail.get(listing.id, True)


def listing_summary(listing: Listing, *, with_distance: bool = True) -> dict:
    """A solo/flat listing pin or row (TSD §3.7 ``listings[]`` shape)."""
    summary = {
        "id": str(listing.id),
        "title": listing.title,
        "asset_class": listing.asset_class,
        "point": point_geojson(listing.point),
        "price_from": listing.daily_price,
        "price_from_display": display(listing.daily_price),
        "photo": cover_url(listing),
        # The listing's own trust tier — the map-pin/list-row badge. A yard's
        # ``supplier.badge`` carries the account verification instead.
        "badge": listing.tier,
        "available": getattr(listing, "_available", True),
    }
    if with_distance:
        summary["distance_km"] = distance_km(listing)
    return summary


def embedded_summary(listing: Listing) -> dict:
    """A listing summary embedded inside a yard card (no point/distance)."""
    return {
        "id": str(listing.id),
        "title": listing.title,
        "asset_class": listing.asset_class,
        "price_from": listing.daily_price,
        "price_from_display": display(listing.daily_price),
        "photo": cover_url(listing),
        "available": getattr(listing, "_available", True),
    }


def class_mix(group: list[Listing]) -> list[str]:
    mix: list[str] = []
    for listing in group:
        if listing.asset_class not in mix:
            mix.append(listing.asset_class)
    return mix
