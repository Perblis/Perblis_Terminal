"""Hire services — request, accept, decline, cancel, list, fetch (FSD §7.1–§7.2).

Business logic lives here; views stay thin. All mutations run in a transaction
and route status changes through ``state.apply`` (the only status writer). The
financials are computed once via the fee engine at request time and re-stamped
nowhere — accept merely locks them (they are already set).
"""

from __future__ import annotations

import datetime as dt

from django.db import transaction
from django.db.models import Q, QuerySet
from django.utils import timezone

from accounts.models import User
from listings.enums import ListingStatus
from listings.models import Listing

from . import availability, errors, fees, state
from .enums import ActorKind, CancelledBy, HireStatus
from .models import Hire, HireEvent

# The Basic-account hire-value ceiling (FSD §4.1): ₦250,000 in kobo.
BASIC_CAP = 25_000_000
REQUEST_TTL = dt.timedelta(hours=24)


def _visible_listing(listing_id) -> Listing:
    """A Live listing from a non-suspended/-deleted supplier, or 404."""
    try:
        return Listing.objects.select_related("supplier", "yard").get(
            id=listing_id,
            status=ListingStatus.LIVE,
            supplier__suspended_at__isnull=True,
            supplier__deleted_at__isnull=True,
        )
    except Listing.DoesNotExist as exc:
        raise errors.ListingNotHireable() from exc


@transaction.atomic
def create_hire(
    *,
    user: User,
    listing_id,
    start_date: dt.date,
    end_date: dt.date,
    hirer_note: str = "",
) -> Hire:
    """Create a Requested hire with a locked-at-acceptance fee preview (FSD §7.1)."""
    listing = _visible_listing(listing_id)
    if listing.supplier_id == user.id:
        raise errors.CannotHireOwnListing()

    days = fees.duration_days(start_date, end_date)
    quote = fees.quote(
        listing.asset_class,
        days=days,
        daily_price=listing.daily_price,
        weekly_price=listing.weekly_price,
        monthly_price=listing.monthly_price,
    )

    # Basic-account cap, evaluated at request time against hire_value (FSD §4.1).
    if not user.is_verified and quote.hire_value > BASIC_CAP:
        raise errors.BasicCapExceeded()

    # The dates must be free to a new hirer (soft availability, TSD §3.4).
    if not availability.is_available(listing, start_date, end_date):
        raise errors.AvailabilityConflict()

    hire = Hire.objects.create(
        listing=listing,
        hirer=user,
        supplier=listing.supplier,
        yard=listing.yard,
        start_date=start_date,
        end_date=end_date,
        duration_days=days,
        scheme=quote.scheme,
        fee_basis=quote.fee_basis,
        hire_value=quote.hire_value,
        service_fee=quote.service_fee,
        payout_amount=quote.payout_amount,
        status=HireStatus.REQUESTED,
        hirer_note=hirer_note,
        request_expires_at=timezone.now() + REQUEST_TTL,
    )
    # The request is the initial state, not a transition — record it on the
    # append-only timeline so the history starts at creation.
    HireEvent.objects.create(
        hire=hire,
        actor_kind=ActorKind.USER,
        actor=user,
        from_status="",
        to_status=HireStatus.REQUESTED,
        meta={"terms_accepted": True},
    )
    return hire


def _get_for_actor(hire_id, user: User, *, must_be_supplier=False) -> Hire:
    try:
        hire = Hire.objects.select_related("listing", "supplier", "hirer").get(id=hire_id)
    except Hire.DoesNotExist as exc:
        raise errors.HireNotFound() from exc
    is_party = user.id in (hire.hirer_id, hire.supplier_id) or user.is_staff
    if not is_party:
        raise errors.HireNotFound()  # don't leak existence to non-parties
    if must_be_supplier and not (user.id == hire.supplier_id or user.is_staff):
        raise errors.TransitionNotPermitted()
    return hire


@transaction.atomic
def accept_hire(*, user: User, hire_id, acknowledgments: dict | None = None) -> Hire:
    """Supplier accepts: terms lock, the 4-hour payment window opens (FSD §7.2)."""
    hire = _get_for_actor(hire_id, user, must_be_supplier=True)
    meta = {"acknowledgments": acknowledgments} if acknowledgments else {}
    state.apply(hire, "accept", actor=user, actor_kind=str(ActorKind.USER), **meta)
    # Open the Bachs checkout once the acceptance has committed — the external
    # call stays out of the DB transaction. The hire conversation (messaging,
    # Wave 5) hangs off the same commit; its hook lands there.
    transaction.on_commit(lambda: _init_payment(hire))
    return hire


def _init_payment(hire: Hire) -> None:
    """Initialise the checkout post-commit; import locally to avoid a cycle."""
    from payments.services import initialize_payment

    initialize_payment(hire)


@transaction.atomic
def decline_hire(*, user: User, hire_id, reason: str) -> Hire:
    """Supplier declines a request with a mandatory reason (FSD §7.1)."""
    if not reason:
        raise errors.ReasonRequired()
    hire = _get_for_actor(hire_id, user, must_be_supplier=True)
    state.apply(hire, "decline", actor=user, actor_kind=str(ActorKind.USER), reason=reason)
    return hire


@transaction.atomic
def cancel_hire(*, user: User, hire_id, reason: str = "") -> Hire:
    """Cancel a hire, role- and state-aware (FSD §7.6).

    Pre-payment (Requested/Accepted) cancellation is free; the refund math for a
    Confirmed cancellation is computed in slice 4D's side-effects.
    """
    hire = _get_for_actor(hire_id, user)
    if user.is_staff:
        cancelled_by = CancelledBy.OPS
    elif user.id == hire.supplier_id:
        cancelled_by = CancelledBy.SUPPLIER
    else:
        cancelled_by = CancelledBy.HIRER

    # A supplier withdrawing a Requested hire is a Decline, not a Cancel.
    if hire.status == HireStatus.REQUESTED and cancelled_by == CancelledBy.SUPPLIER:
        raise errors.TransitionNotPermitted()

    state.apply(
        hire,
        "cancel",
        actor=user,
        actor_kind=str(ActorKind.OPS if user.is_staff else ActorKind.USER),
        cancelled_by=str(cancelled_by),
        reason=reason,
    )
    return hire


def list_hires(*, user: User, role: str | None = None, status: str | None = None) -> QuerySet[Hire]:
    """Hires the user is party to, newest first (cursor-paginated by the view)."""
    if role == "hirer":
        qs = Hire.objects.filter(hirer=user)
    elif role == "supplier":
        qs = Hire.objects.filter(supplier=user)
    else:
        qs = Hire.objects.filter(Q(hirer=user) | Q(supplier=user))
    if status:
        qs = qs.filter(status=status)
    return qs.select_related("listing", "supplier", "hirer").order_by("-created_at")


def get_hire(*, user: User, hire_id) -> Hire:
    """A single hire with its event timeline, visible only to its parties."""
    hire = _get_for_actor(hire_id, user)
    return hire
