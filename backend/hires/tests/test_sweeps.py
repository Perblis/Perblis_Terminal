"""Timed-sweep tests (TSD §3.5) — each transition fires once and is idempotent."""

from __future__ import annotations

import datetime as dt
from typing import cast

import pytest
from django.utils import timezone

from hires import tasks
from hires.enums import CancelledBy, HireStatus
from hires.factories import HireFactory
from hires.models import Hire
from listings.enums import ListingStatus
from listings.factories import ListingFactory

pytestmark = pytest.mark.django_db


def _listing():
    return ListingFactory(status=ListingStatus.LIVE, unit_count=1, daily_price=8_000_000)


def _hire(**kw) -> Hire:
    return cast(Hire, HireFactory(listing=_listing(), **kw))


def test_expire_stale_requests():
    hire = _hire(request_expires_at=timezone.now() - dt.timedelta(hours=1))
    assert tasks.expire_stale_requests() == 1
    hire.refresh_from_db()
    assert hire.status == HireStatus.EXPIRED
    # A fresh request is untouched.
    fresh = _hire(request_expires_at=timezone.now() + dt.timedelta(hours=5))
    assert tasks.expire_stale_requests() == 0
    fresh.refresh_from_db()
    assert fresh.status == HireStatus.REQUESTED


def test_cancel_expired_payments():
    hire = _hire(accepted=True, payment_deadline=timezone.now() - dt.timedelta(minutes=1))
    assert tasks.cancel_expired_payments() == 1
    hire.refresh_from_db()
    assert hire.status == HireStatus.CANCELLED
    assert hire.cancelled_by == CancelledBy.SYSTEM
    assert hire.cancel_reason == "payment_expired"


def test_auto_start_after_start_plus_24h():
    today = timezone.localdate()
    started = _hire(
        confirmed=True,
        start_date=today - dt.timedelta(days=2),
        end_date=today + dt.timedelta(days=3),
    )
    # A hire starting today is not yet auto-started (needs start+24h).
    not_yet = _hire(confirmed=True, start_date=today, end_date=today + dt.timedelta(days=2))
    assert tasks.auto_start_hires() == 1
    started.refresh_from_db()
    not_yet.refresh_from_db()
    assert started.status == HireStatus.ON_HIRE
    assert not_yet.status == HireStatus.CONFIRMED


def test_auto_complete_after_end_plus_48h():
    today = timezone.localdate()
    done = _hire(
        on_hire=True,
        start_date=today - dt.timedelta(days=10),
        end_date=today - dt.timedelta(days=3),
    )
    recent = _hire(
        on_hire=True,
        start_date=today - dt.timedelta(days=5),
        end_date=today,  # ended today → within the 48h grace
    )
    assert tasks.auto_complete_hires() == 1
    done.refresh_from_db()
    recent.refresh_from_db()
    assert done.status == HireStatus.COMPLETED
    assert recent.status == HireStatus.ON_HIRE


def test_run_due_transitions_is_idempotent():
    today = timezone.localdate()
    _hire(request_expires_at=timezone.now() - dt.timedelta(hours=1))
    _hire(accepted=True, payment_deadline=timezone.now() - dt.timedelta(minutes=1))
    _hire(
        confirmed=True,
        start_date=today - dt.timedelta(days=2),
        end_date=today + dt.timedelta(days=2),
    )

    first = tasks.run_due_transitions()
    assert first == {"expired": 1, "payment_cancelled": 1, "started": 1, "completed": 0}
    # Second run touches nothing — every hire has left its candidate set.
    second = tasks.run_due_transitions()
    assert second == {"expired": 0, "payment_cancelled": 0, "started": 0, "completed": 0}
