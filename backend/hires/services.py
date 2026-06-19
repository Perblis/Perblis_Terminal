"""Hire services — request, accept, decline, cancel, list, fetch (FSD §7.1–§7.2).

Business logic lives here; views stay thin. All mutations run in a transaction
and route status changes through ``state.apply`` (the only status writer). The
financials are computed once via the fee engine at request time and re-stamped
nowhere — accept merely locks them (they are already set).
"""

from __future__ import annotations

import datetime as dt

import structlog
from django.db import transaction
from django.db.models import Q, QuerySet
from django.utils import timezone

from accounts.models import User
from listings.enums import ListingStatus
from listings.models import Listing

from . import availability, errors, fees, state
from .enums import ActorKind, CancelledBy, HandoverKind, HireStatus
from .models import HandoverRecord, Hire, HireEvent

logger = structlog.get_logger(__name__)

# A dispute may be raised during On Hire or up to 72h after the hire's end.
DISPUTE_WINDOW = dt.timedelta(hours=72)

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
    from payments.errors import CheckoutUnavailable
    from payments.services import initialize_payment

    try:
        initialize_payment(hire)
    except CheckoutUnavailable:
        logger.exception("payments.init_checkout_unavailable", hire=str(hire.id))


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

    was_paid = hire.status == HireStatus.CONFIRMED
    state.apply(
        hire,
        "cancel",
        actor=user,
        actor_kind=str(ActorKind.OPS if user.is_staff else ActorKind.USER),
        cancelled_by=str(cancelled_by),
        reason=reason,
    )
    # A paid hire's cancellation triggers the §7.6 refund (+ supplier strike).
    # Runs post-commit so the Bachs refund call stays out of the transaction.
    if was_paid:
        transaction.on_commit(
            lambda: _issue_refund(hire, cancelled_by=str(cancelled_by), reason=reason)
        )
    return hire


def _issue_refund(hire: Hire, *, cancelled_by: str, reason: str) -> None:
    from payments.services import issue_refund

    issue_refund(hire, cancelled_by=cancelled_by, reason=reason)


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


# --- handovers (FSD §7.4) ---------------------------------------------------
@transaction.atomic
def submit_handover(
    *, user: User, hire_id, kind: str, photos: list[str], reading: dict | None = None
) -> HandoverRecord:
    """Record on-hire / off-hire evidence. Non-blocking; absence = no-show proof."""
    hire = _get_for_actor(hire_id, user)
    if kind == HandoverKind.ON_HIRE and hire.status not in (
        HireStatus.CONFIRMED,
        HireStatus.ON_HIRE,
    ):
        raise errors.InvalidTransition()
    if kind == HandoverKind.OFF_HIRE and hire.status != HireStatus.ON_HIRE:
        raise errors.InvalidTransition()
    return HandoverRecord.objects.create(
        hire=hire, kind=kind, photos=photos, reading=reading or {}, submitted_by=user
    )


@transaction.atomic
def confirm_handover(*, user: User, handover_id) -> HandoverRecord:
    """The counterparty confirms a handover, advancing the hire's lifecycle."""
    try:
        handover = HandoverRecord.objects.select_related("hire").get(id=handover_id)
    except HandoverRecord.DoesNotExist as exc:
        raise errors.HireNotFound() from exc
    hire = handover.hire
    if user.id not in (hire.hirer_id, hire.supplier_id) and not user.is_staff:
        raise errors.HireNotFound()
    if user.id == handover.submitted_by_id and not user.is_staff:
        raise errors.TransitionNotPermitted()  # the *other* party confirms

    handover.confirmed_by = user
    handover.confirmed_at = timezone.now()
    handover.save(update_fields=["confirmed_by", "confirmed_at", "updated_at"])

    # A confirmed on-hire handover starts the hire; an off-hire one completes it.
    if handover.kind == HandoverKind.ON_HIRE and hire.status == HireStatus.CONFIRMED:
        state.apply(hire, "start", actor=user, actor_kind=str(ActorKind.USER))
    elif handover.kind == HandoverKind.OFF_HIRE and hire.status == HireStatus.ON_HIRE:
        state.apply(hire, "complete", actor=user, actor_kind=str(ActorKind.USER))
        _payouts().create_completion_payout(hire)
    return handover


def _payouts():
    """Local import of the payments service to avoid an import cycle."""
    from payments import services as payments_services

    return payments_services


# --- disputes (FSD §7.3) ----------------------------------------------------
def _end_plus_window(hire: Hire) -> dt.datetime:
    end_midnight = timezone.make_aware(
        dt.datetime.combine(hire.end_date + dt.timedelta(days=1), dt.time.min),
        timezone.get_current_timezone(),
    )
    return end_midnight + DISPUTE_WINDOW


@transaction.atomic
def raise_dispute(*, user: User, hire_id, reason: str) -> Hire:
    """Either party flags a dispute (On Hire, or ≤72h after end). Freezes payout."""
    if not reason:
        raise errors.ReasonRequired()
    hire = _get_for_actor(hire_id, user)
    if hire.status == HireStatus.COMPLETED and timezone.now() > _end_plus_window(hire):
        raise errors.InvalidTransition()
    state.apply(hire, "dispute", actor=user, actor_kind=str(ActorKind.USER), reason=reason)
    _payouts().freeze_payouts(hire)  # any due payout is frozen until resolution
    return hire


@transaction.atomic
def resolve_dispute(*, user: User, hire_id, outcome: str, reason: str = "") -> Hire:
    """Ops resolves a dispute to Completed or Cancelled (Wave 6 surface; service now)."""
    hire = _get_for_actor(hire_id, user)
    if not user.is_staff:
        raise errors.TransitionNotPermitted()
    action = "resolve_complete" if outcome == "complete" else "resolve_cancel"
    state.apply(hire, action, actor=user, actor_kind=str(ActorKind.OPS), reason=reason)
    if outcome == "complete":
        # Resolution to Completed lifts the freeze and queues the payout.
        _payouts().create_completion_payout(hire)
    return hire
