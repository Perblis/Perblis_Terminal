"""Public storefront assembly (FSD §5.3).

A supplier's read-only company page: logo, name, verification badge,
member-since, about, yards (mini-map data) and Live listings. No fee fields
(D-014), no hire CTA. A suspended or deleted supplier 404s — storefront and
listings are hidden together.
"""

from __future__ import annotations

from django.http import Http404

from accounts.models import AccountLevel, User
from core import media
from core.money import display
from hires.availability import availability_map
from listings.enums import ListingStatus
from listings.models import Listing
from suppliers.models import SupplierProfile, Yard

_BADGE = {
    AccountLevel.VERIFIED: "verified",
    AccountLevel.BUSINESS_VERIFIED: "business_verified",
}


def _point_geojson(point) -> dict | None:
    if point is None:
        return None
    return {"type": "Point", "coordinates": [point.x, point.y]}


def _cover_url(listing: Listing) -> str:
    photos = list(listing.photos.all())
    cover = next((p for p in photos if p.is_cover), photos[0] if photos else None)
    return media.public_url(cover.r2_key) if cover else ""


def get_storefront(*, supplier_id) -> dict:
    user = User.objects.filter(id=supplier_id, is_supplier=True).first()
    if user is None or user.is_suspended or user.is_deleted:
        raise Http404()

    profile = SupplierProfile.objects.filter(user=user).first()
    # order_by is load-bearing, not tidiness: without it Postgres returns heap
    # order, which changes after any UPDATE to a row — so the same storefront
    # could list its assets differently on two consecutive reads. ids are
    # UUIDv7, so ordering by id is creation order.
    live = list(
        Listing.objects.filter(supplier=user, status=ListingStatus.LIVE)
        .order_by("id")
        .prefetch_related("photos")
    )
    # One grouped aggregate for the whole storefront (hires/availability.py),
    # so this stays N+1-free however many assets a supplier lists.
    free = availability_map(live)
    live_by_yard: dict = {}
    for listing in live:
        live_by_yard[listing.yard_id] = live_by_yard.get(listing.yard_id, 0) + 1

    yards = [
        {
            "id": str(y.id),
            "name": y.name,
            "point": _point_geojson(y.point),
            "listing_count": live_by_yard.get(y.id, 0),
        }
        for y in Yard.objects.filter(supplier=user)
    ]

    listings = [
        {
            "id": str(listing.id),
            "title": listing.title,
            "asset_class": listing.asset_class,
            "asset_type": listing.asset_type,
            "daily_price_display": display(listing.daily_price),
            "cover_photo_url": _cover_url(listing),
            "yard_id": str(listing.yard_id) if listing.yard_id else None,
            # Additive since 2026-08-10 (D-030). A storefront card has to answer
            # "is this suitable, is it trustworthy, can I have it" without the
            # hirer opening every asset, and none of that was on this payload:
            # the app was reading GET /listings/{id} once per card to get it.
            # `specs` is the same dict the listing detail returns — no fee
            # fields exist on it, so D-014 is unaffected.
            "specs": listing.specs,
            "tier": listing.tier,
            "available": free.get(listing.id, True),
        }
        for listing in live
    ]

    return {
        "supplier_id": str(user.id),
        "business_name": profile.business_name if profile else "",
        "logo_url": media.public_url(profile.logo_key) if profile else "",
        "verification_badge": _BADGE.get(user.account_level),
        "member_since": user.created_at.date().isoformat(),
        "about": profile.description if profile else "",
        "yards": yards,
        "live_listings": listings,
    }
