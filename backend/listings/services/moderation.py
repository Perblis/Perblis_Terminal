"""Ops listing moderation (wave-6 §6.5).

Pause / remove a listing and award a trust tier. Status changes go through the
state machine (``listings.state.apply`` — the only status writer); tier is not a
status, so it's set directly. Removal notifies the supplier and preserves hire
history (no cascade).
"""

from __future__ import annotations

from django.db import transaction

from listings import errors, notifications, state
from listings.enums import ListingTier
from listings.models import Listing

# Tiers Ops can award manually (MVP). Basic is the publish default.
AWARDABLE_TIERS = {ListingTier.BASIC, ListingTier.VERIFIED, ListingTier.INSPECTED}


@transaction.atomic
def pause_listing(listing: Listing) -> Listing:
    return state.apply(listing, "pause")


@transaction.atomic
def remove_listing(listing: Listing, *, reason: str) -> Listing:
    if not reason.strip():
        raise errors.InvalidTransition()  # reason is mandatory for a takedown
    state.apply(listing, "remove", reason=reason)
    transaction.on_commit(lambda: notifications.notify_listing_removed(listing, reason=reason))
    return listing


@transaction.atomic
def award_tier(listing: Listing, *, tier: str) -> Listing:
    if tier not in AWARDABLE_TIERS:
        raise errors.InvalidTransition()
    listing.tier = tier
    listing.save(update_fields=["tier", "updated_at"])
    return listing
