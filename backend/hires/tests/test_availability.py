"""Availability engine tests (TSD §3.4)."""

from __future__ import annotations

import datetime as dt
from typing import cast

import pytest
from django.utils import timezone

from hires import availability
from hires.factories import HireFactory
from hires.models import Hire
from listings.enums import ListingStatus
from listings.factories import ListingFactory

pytestmark = pytest.mark.django_db


def _hire(**kw) -> Hire:
    return cast(Hire, HireFactory(**kw))


START = dt.date(2026, 8, 1)
END = dt.date(2026, 8, 10)


@pytest.fixture
def listing():
    return ListingFactory(status=ListingStatus.LIVE, unit_count=1, daily_price=8_000_000)


def test_requested_hire_does_not_hold_dates(listing):
    _hire(listing=listing, start_date=START, end_date=END)  # requested by default
    assert availability.is_available(listing, START, END) is True
    assert availability.overlapping_holds(listing, START, END) == 0


def test_accepted_with_live_window_holds(listing):
    _hire(listing=listing, start_date=START, end_date=END, accepted=True)
    assert availability.is_available(listing, START, END) is False


def test_accepted_with_expired_window_does_not_hold(listing):
    _hire(
        listing=listing,
        start_date=START,
        end_date=END,
        accepted=True,
        payment_deadline=timezone.now() - dt.timedelta(minutes=1),
    )
    assert availability.is_available(listing, START, END) is True


@pytest.mark.parametrize("trait", ["confirmed", "on_hire"])
def test_confirmed_and_on_hire_hold(listing, trait):
    _hire(listing=listing, start_date=START, end_date=END, **{trait: True})
    assert availability.is_available(listing, START, END) is False


def test_non_overlapping_dates_are_available(listing):
    _hire(listing=listing, start_date=START, end_date=END, confirmed=True)
    later_start = END + dt.timedelta(days=1)
    later_end = later_start + dt.timedelta(days=3)
    assert availability.is_available(listing, later_start, later_end) is True


def test_multi_unit_capacity(listing):
    listing.unit_count = 2
    listing.save(update_fields=["unit_count"])
    _hire(listing=listing, start_date=START, end_date=END, confirmed=True)
    assert availability.is_available(listing, START, END) is True  # 1 of 2 free
    assert availability.free_units(listing, START, END) == 1
    _hire(listing=listing, start_date=START, end_date=END, confirmed=True)
    assert availability.is_available(listing, START, END) is False  # 0 of 2 free
    assert availability.free_units(listing, START, END) == 0


def test_exclude_hire_id_excludes_self(listing):
    h = _hire(listing=listing, start_date=START, end_date=END, confirmed=True)
    assert availability.is_available(listing, START, END, exclude_hire_id=h.id) is True
