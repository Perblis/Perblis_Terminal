"""Listing photo service — attach / reorder (FSD §5.2 step ④, ≤10 photos).

Bytes are uploaded directly to the public bucket via the media presign
pipeline; here we only attach the returned key, cap the count, and manage
ordering + the single cover.
"""

from __future__ import annotations

from django.db import transaction
from django.shortcuts import get_object_or_404

from accounts.models import User
from listings.errors import PhotoLimitExceeded, PhotoNotFound
from listings.models import Listing, ListingPhoto

MAX_PHOTOS = 10


@transaction.atomic
def attach_photo(*, user: User, listing_id, r2_key: str, is_cover: bool = False) -> ListingPhoto:
    listing = get_object_or_404(Listing.objects.select_for_update(), id=listing_id, supplier=user)
    existing = list(listing.photos.all())
    if len(existing) >= MAX_PHOTOS:
        raise PhotoLimitExceeded()
    first = len(existing) == 0
    if is_cover or first:
        listing.photos.update(is_cover=False)
    return ListingPhoto.objects.create(
        listing=listing,
        r2_key=r2_key,
        position=len(existing),
        is_cover=is_cover or first,
    )


@transaction.atomic
def reorder_photos(*, user: User, listing_id, items: list[dict]) -> list[ListingPhoto]:
    """Set positions + the single cover. ``items``: [{id, position, is_cover}]."""
    listing = get_object_or_404(Listing.objects.select_for_update(), id=listing_id, supplier=user)
    photos = {str(p.id): p for p in listing.photos.all()}
    for item in items:
        photo = photos.get(str(item["id"]))
        if photo is None:
            raise PhotoNotFound()
        photo.position = item["position"]
        photo.is_cover = bool(item.get("is_cover", False))
    ListingPhoto.objects.bulk_update(photos.values(), ["position", "is_cover"])
    return sorted(photos.values(), key=lambda p: p.position)
