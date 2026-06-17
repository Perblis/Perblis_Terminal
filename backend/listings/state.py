"""Listing status state machine — the ONLY path that changes ``status``.

Draft → Live ⇄ Paused → Archived. ``removed`` is Ops-only (no public action).
Going Live applies the publish gates (FSD §5.2); each failure raises its own
stable error code. Tier auto-resets to Basic at publish (upper tiers are
Ops-awarded in Wave 6).
"""

from __future__ import annotations

from listings import errors
from listings.enums import ListingStatus, ListingTier
from listings.models import Listing
from listings.services.specs import get_template, missing_required_specs
from suppliers.services.profile import profile_complete


def _check_publish_gates(listing: Listing) -> None:
    if not listing.daily_price or listing.daily_price <= 0:
        raise errors.PublishRequiresDailyPrice()
    if not listing.photos.exists():
        raise errors.PublishRequiresPhoto()
    if listing.point is None:
        raise errors.PublishRequiresLocation()
    template = get_template(listing.asset_class, listing.asset_type)
    if template is None:
        raise errors.InvalidAssetType()
    missing = missing_required_specs(template, listing.specs)
    if missing:
        raise errors.PublishRequiresSpecs(fields=dict.fromkeys(missing, "Required."))
    if not listing.supplier.is_verified:
        raise errors.VerificationRequired()
    if not profile_complete(listing.supplier):
        raise errors.BusinessProfileIncomplete()


def apply(listing: Listing, action: str) -> Listing:
    """Apply a status transition in place (call inside a transaction)."""
    if action == "publish":
        if listing.status not in (ListingStatus.DRAFT, ListingStatus.PAUSED):
            raise errors.InvalidTransition()
        _check_publish_gates(listing)
        listing.status = ListingStatus.LIVE
        listing.tier = ListingTier.BASIC
        listing.save(update_fields=["status", "tier", "updated_at"])
    elif action == "pause":
        if listing.status != ListingStatus.LIVE:
            raise errors.InvalidTransition()
        listing.status = ListingStatus.PAUSED
        listing.save(update_fields=["status", "updated_at"])
    elif action == "archive":
        if listing.status not in (ListingStatus.DRAFT, ListingStatus.LIVE, ListingStatus.PAUSED):
            raise errors.InvalidTransition()
        listing.status = ListingStatus.ARCHIVED
        listing.save(update_fields=["status", "updated_at"])
    else:
        raise errors.InvalidTransition()
    return listing
