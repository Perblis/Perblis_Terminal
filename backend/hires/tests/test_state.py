"""Hire state-machine tests (FSD §7.3).

Every legal edge is exercised, every illegal one is rejected, an event is
appended per transition, and the capacity guards (accept/pay re-check under the
listing lock) + auto-decline of overflowed competitors are covered.
"""

from __future__ import annotations

import datetime as dt
from typing import cast

import pytest
from django.db import transaction
from django.utils import timezone

from hires import errors, state
from hires.enums import ActorKind, CancelledBy, HireStatus
from hires.factories import HireFactory
from hires.models import Hire, HireEvent
from listings.enums import ListingStatus
from listings.factories import ListingFactory

pytestmark = pytest.mark.django_db

START = dt.date(2026, 9, 1)
END = dt.date(2026, 9, 5)


def _hire(**kw) -> Hire:
    return cast(Hire, HireFactory(**kw))


@pytest.fixture
def listing():
    return ListingFactory(status=ListingStatus.LIVE, unit_count=1, daily_price=8_000_000)


def _apply(hire, action, **kw):
    with transaction.atomic():
        return state.apply(hire, action, **kw)


# --- legal transitions ------------------------------------------------------
def test_accept_sets_status_window_and_event(listing):
    hire = _hire(listing=listing, start_date=START, end_date=END)
    supplier = listing.supplier
    _apply(hire, "accept", actor=supplier, actor_kind=ActorKind.USER)
    hire.refresh_from_db()
    assert hire.status == HireStatus.ACCEPTED
    assert hire.payment_deadline is not None
    # ~4h window.
    assert hire.payment_deadline - timezone.now() < dt.timedelta(hours=4, minutes=1)
    ev = hire.events.latest("created_at")
    assert (ev.from_status, ev.to_status) == (HireStatus.REQUESTED, HireStatus.ACCEPTED)
    assert ev.actor_id == supplier.id and ev.actor_kind == ActorKind.USER


def test_decline_records_reason(listing):
    hire = _hire(listing=listing)
    _apply(hire, "decline", actor=listing.supplier, reason="not available")
    hire.refresh_from_db()
    assert hire.status == HireStatus.DECLINED
    assert hire.decline_reason == "not available"


def test_expire(listing):
    hire = _hire(listing=listing)
    _apply(hire, "expire", actor_kind=ActorKind.SYSTEM)
    hire.refresh_from_db()
    assert hire.status == HireStatus.EXPIRED


def test_pay_confirms(listing):
    hire = _hire(listing=listing, start_date=START, end_date=END, accepted=True)
    _apply(hire, "pay", actor_kind=ActorKind.SYSTEM)
    hire.refresh_from_db()
    assert hire.status == HireStatus.CONFIRMED


@pytest.mark.parametrize(
    "trait,frm",
    [
        ({}, HireStatus.REQUESTED),
        ({"accepted": True}, HireStatus.ACCEPTED),
        ({"confirmed": True}, HireStatus.CONFIRMED),
    ],
)
def test_cancel_from_each_pre_terminal_state(listing, trait, frm):
    hire = _hire(listing=listing, start_date=START, end_date=END, **trait)
    _apply(hire, "cancel", actor_kind=ActorKind.SYSTEM, cancelled_by=CancelledBy.HIRER, reason="x")
    hire.refresh_from_db()
    assert hire.status == HireStatus.CANCELLED
    assert hire.cancelled_by == CancelledBy.HIRER


def test_start_complete_flow(listing):
    hire = _hire(listing=listing, start_date=START, end_date=END, confirmed=True)
    _apply(hire, "start", actor_kind=ActorKind.SYSTEM)
    hire.refresh_from_db()
    assert hire.status == HireStatus.ON_HIRE
    _apply(hire, "complete", actor_kind=ActorKind.SYSTEM)
    hire.refresh_from_db()
    assert hire.status == HireStatus.COMPLETED


def test_dispute_then_resolve(listing):
    hire = _hire(listing=listing, start_date=START, end_date=END, on_hire=True)
    _apply(hire, "dispute", actor=hire.hirer)
    hire.refresh_from_db()
    assert hire.status == HireStatus.IN_DISPUTE
    _apply(hire, "resolve_complete", actor_kind=ActorKind.OPS, actor=hire.hirer)
    hire.refresh_from_db()
    assert hire.status == HireStatus.COMPLETED


def test_event_appended_for_every_transition(listing):
    hire = _hire(listing=listing, start_date=START, end_date=END)
    _apply(hire, "accept", actor=listing.supplier)
    _apply(hire, "pay", actor_kind=ActorKind.SYSTEM)
    assert HireEvent.objects.filter(hire=hire).count() == 2


# --- illegal transitions ----------------------------------------------------
@pytest.mark.parametrize(
    "trait,action",
    [
        ({"confirmed": True}, "accept"),  # accept only from requested
        ({}, "pay"),  # pay only from accepted
        ({}, "start"),  # start only from confirmed
        ({"accepted": True}, "complete"),  # complete only from on_hire
        ({"confirmed": True}, "dispute"),  # dispute only from on_hire
        ({}, "frobnicate"),  # unknown action
    ],
)
def test_illegal_transition_rejected(listing, trait, action):
    hire = _hire(listing=listing, start_date=START, end_date=END, **trait)
    with pytest.raises(errors.InvalidTransition):
        _apply(hire, action, actor_kind=ActorKind.SYSTEM)


# --- capacity guards --------------------------------------------------------
def test_accept_blocked_when_unit_confirmed(listing):
    # A confirmed hire has *taken* the single unit — no more accepts.
    _hire(listing=listing, start_date=START, end_date=END, confirmed=True)
    contender = _hire(listing=listing, start_date=START, end_date=END)
    with pytest.raises(errors.AvailabilityConflict):
        _apply(contender, "accept", actor=listing.supplier)


def test_accept_allows_oversell_of_competing_requests(listing):
    # Two overlapping requests may both be accepted (soft holds); first-to-pay
    # wins. Neither accept is blocked while no unit is confirmed.
    a = _hire(listing=listing, start_date=START, end_date=END)
    b = _hire(listing=listing, start_date=START, end_date=END)
    _apply(a, "accept", actor=listing.supplier)
    _apply(b, "accept", actor=listing.supplier)
    a.refresh_from_db()
    b.refresh_from_db()
    assert a.status == b.status == HireStatus.ACCEPTED


def test_pay_rechecks_capacity_and_loses(listing):
    # Simulate a race outcome: this hire is accepted, but another hire grabbed
    # the only unit (confirmed) meanwhile. Paying must lose on the re-check.
    hire = _hire(listing=listing, start_date=START, end_date=END, accepted=True)
    _hire(listing=listing, start_date=START, end_date=END, confirmed=True)
    with pytest.raises(errors.AvailabilityConflict):
        _apply(hire, "pay", actor_kind=ActorKind.SYSTEM)


# --- auto-decline of overflowed competitors on Confirmed --------------------
def test_pay_auto_declines_overflow_competitors(listing):
    winner = _hire(listing=listing, start_date=START, end_date=END, accepted=True)
    losers = [_hire(listing=listing, start_date=START, end_date=END) for _ in range(3)]
    _apply(winner, "pay", actor_kind=ActorKind.SYSTEM)
    winner.refresh_from_db()
    assert winner.status == HireStatus.CONFIRMED
    for loser in losers:
        loser.refresh_from_db()
        assert loser.status == HireStatus.CANCELLED
        assert loser.cancelled_by == CancelledBy.SYSTEM
        assert loser.cancel_reason == "no_longer_available"
        # Their cancellation is event-logged too.
        assert loser.events.filter(to_status=HireStatus.CANCELLED).exists()


def test_pay_keeps_competitors_when_capacity_remains(listing):
    listing.unit_count = 2
    listing.save(update_fields=["unit_count"])
    winner = _hire(listing=listing, start_date=START, end_date=END, accepted=True)
    other = _hire(listing=listing, start_date=START, end_date=END)
    _apply(winner, "pay", actor_kind=ActorKind.SYSTEM)
    other.refresh_from_db()
    assert other.status == HireStatus.REQUESTED  # a free unit remains


# --- append-only event log --------------------------------------------------
def test_hire_event_is_append_only(listing):
    hire = _hire(listing=listing)
    _apply(hire, "expire", actor_kind=ActorKind.SYSTEM)
    ev = hire.events.latest("created_at")
    ev.to_status = HireStatus.COMPLETED
    with pytest.raises(RuntimeError):
        ev.save(update_fields=["to_status"])
    with pytest.raises(RuntimeError):
        ev.delete()
