"""Hire state machine — the ONLY path that writes ``Hire.status`` (FSD §7.3).

``apply(hire, action, ...)`` validates the transition is legal from the hire's
current state, re-checks capacity under a row lock where the action consumes a
unit (``accept``, ``pay`` — the binding race rule, TSD §3.4), writes the new
status, appends an immutable ``HireEvent``, and queues side-effects on commit.
No status is written anywhere else, and no status is written without its event.

Call inside a transaction (capacity-locking actions take ``SELECT … FOR
UPDATE``); the service layer owns the ``@transaction.atomic`` boundary.
"""

from __future__ import annotations

import datetime as dt
import logging
from dataclasses import dataclass

from django.db import transaction
from django.utils import timezone

from listings.models import Listing

from . import availability, errors
from .enums import ActorKind, CancelledBy, HireStatus
from .models import Hire, HireEvent

logger = logging.getLogger(__name__)

# The payment window opens at acceptance (FSD §3.2 / §7.3).
PAYMENT_WINDOW = dt.timedelta(hours=4)

# Status/actor codes as plain strings. (Without django-stubs the type checker
# reads TextChoices members as ``tuple[str, str]``; their string values are what
# we actually compare against and store.)
_REQUESTED = str(HireStatus.REQUESTED)
_ACCEPTED = str(HireStatus.ACCEPTED)
_CONFIRMED = str(HireStatus.CONFIRMED)
_ON_HIRE = str(HireStatus.ON_HIRE)
_COMPLETED = str(HireStatus.COMPLETED)
_DECLINED = str(HireStatus.DECLINED)
_EXPIRED = str(HireStatus.EXPIRED)
_CANCELLED = str(HireStatus.CANCELLED)
_IN_DISPUTE = str(HireStatus.IN_DISPUTE)

_USER = str(ActorKind.USER)
_OPS = str(ActorKind.OPS)
_SYSTEM = str(ActorKind.SYSTEM)


@dataclass(frozen=True)
class _T:
    """A legal transition: the states it may start from and the state it lands in."""

    froms: tuple[str, ...]
    to: str
    # accept/pay consume a unit → re-check availability under a listing row lock.
    locks_capacity: bool = False


# FSD §7.3 state table (normative). ``cancel`` is polymorphic (its ``cancelled_by``
# + reason come from meta); everything else is a single edge.
TRANSITIONS: dict[str, _T] = {
    "accept": _T((_REQUESTED,), _ACCEPTED, locks_capacity=True),
    "decline": _T((_REQUESTED,), _DECLINED),
    "expire": _T((_REQUESTED,), _EXPIRED),
    "pay": _T((_ACCEPTED,), _CONFIRMED, locks_capacity=True),
    "cancel": _T((_REQUESTED, _ACCEPTED, _CONFIRMED), _CANCELLED),
    "start": _T((_CONFIRMED,), _ON_HIRE),
    "complete": _T((_ON_HIRE,), _COMPLETED),
    # Disputable during On Hire, or shortly after completion (the ≤72h-after-end
    # window is enforced by the service).
    "dispute": _T((_ON_HIRE, _COMPLETED), _IN_DISPUTE),
    "resolve_complete": _T((_IN_DISPUTE,), _COMPLETED),
    "resolve_cancel": _T((_IN_DISPUTE,), _CANCELLED),
}


def apply(
    hire: Hire,
    action: str,
    *,
    actor=None,
    actor_kind: str = _USER,
    **meta,
) -> Hire:
    """Apply ``action`` to ``hire`` in place. The sole writer of ``Hire.status``.

    ``meta`` carries transition data: ``reason``, ``cancelled_by``,
    ``acknowledgments`` — and is stored verbatim on the event.
    """
    t = TRANSITIONS.get(action)
    if t is None or hire.status not in t.froms:
        raise errors.InvalidTransition()

    from_status = hire.status
    update_fields = ["status", "updated_at"]

    if t.locks_capacity:
        # Binding race rule: lock the listing row, then re-check hard capacity
        # (confirmed/on_hire). Accepted holds don't block — oversell is allowed
        # and settled by first-to-pay (FSD §7.3).
        listing = Listing.objects.select_for_update().get(pk=hire.listing_id)
        if not availability.can_confirm(
            listing, hire.start_date, hire.end_date, exclude_hire_id=hire.id
        ):
            raise errors.AvailabilityConflict()

    if action == "accept":
        hire.payment_deadline = timezone.now() + PAYMENT_WINDOW
        update_fields.append("payment_deadline")
        if "acknowledgments" in meta:
            hire.acknowledgments = meta["acknowledgments"]
            update_fields.append("acknowledgments")
    elif action == "decline":
        hire.decline_reason = meta.get("reason", "")
        update_fields.append("decline_reason")
    elif action == "cancel":
        hire.cancelled_by = meta.get("cancelled_by")
        hire.cancel_reason = meta.get("reason", "")
        update_fields += ["cancelled_by", "cancel_reason"]

    hire.status = t.to
    hire.save(update_fields=update_fields)

    _write_event(hire, actor=actor, actor_kind=actor_kind, frm=from_status, to=t.to, meta=meta)

    # On entering Confirmed, the same transaction forces out overflowed
    # competitors (first-to-pay wins, FSD §7.3).
    if action == "pay":
        _auto_decline_overflow(hire)

    _queue_side_effects(hire, action, from_status, t.to)
    return hire


def _write_event(hire: Hire, *, actor, actor_kind: str, frm: str, to: str, meta: dict) -> None:
    HireEvent.objects.create(
        hire=hire,
        actor_kind=actor_kind,
        actor=actor if actor_kind in (_USER, _OPS) else None,
        from_status=frm,
        to_status=to,
        meta=meta,
    )


def _auto_decline_overflow(confirmed: Hire) -> list[Hire]:
    """Auto-cancel overlapping Requested/Accepted hires that can no longer be
    served now that ``confirmed`` has taken a unit (``no_longer_available``)."""
    listing = Listing.objects.get(pk=confirmed.listing_id)
    if availability.can_confirm(listing, confirmed.start_date, confirmed.end_date):
        return []  # a hard unit is still free — nobody is forced out
    competitors = (
        Hire.objects.select_for_update()
        .filter(
            listing_id=confirmed.listing_id,
            status__in=[HireStatus.REQUESTED, HireStatus.ACCEPTED],
            start_date__lte=confirmed.end_date,
            end_date__gte=confirmed.start_date,
        )
        .exclude(id=confirmed.id)
    )
    forced_out = []
    for c in competitors:
        apply(
            c,
            "cancel",
            actor=None,
            actor_kind=_SYSTEM,
            cancelled_by=str(CancelledBy.SYSTEM),
            reason="no_longer_available",
        )
        forced_out.append(c)
    return forced_out


def _queue_side_effects(hire: Hire, action: str, from_status: str, to_status: str) -> None:
    """Fire post-commit side-effects: the FSD §9 notification for the new state.

    Runs after commit so an email is only sent for a transition that actually
    persisted, and a delivery failure never rolls back the transition. Payout
    creation is wired explicitly by the completing services (atomic with the
    transition); notifications are best-effort here.
    """

    def _run() -> None:
        logger.info(
            "hire.transition", extra={"hire": str(hire.id), "from": from_status, "to": to_status}
        )
        from . import notifications

        notifications.dispatch(hire, to_status=to_status)

    transaction.on_commit(_run)
