"""Public availability-calendar tests — GET /listings/{id}/availability."""

from __future__ import annotations

import datetime as dt

import pytest
from django.utils import timezone
from hypothesis import HealthCheck, given, settings
from hypothesis import strategies as st

from hires import availability
from hires.factories import HireFactory
from hires.models import AvailabilityBlock
from listings.enums import ListingStatus
from listings.factories import ListingFactory

pytestmark = pytest.mark.django_db


def _url(listing) -> str:
    return f"/api/v1/listings/{listing.id}/availability"


@pytest.fixture
def listing(supplier):
    return ListingFactory(
        supplier=supplier, status=ListingStatus.LIVE, daily_price=8_000_000, unit_count=2
    )


def _day(offset: int) -> dt.date:
    return timezone.localdate() + dt.timedelta(days=offset)


# --- endpoint contract ---------------------------------------------------------
def test_anonymous_gets_default_30_day_window(api, listing):
    resp = api.get(_url(listing))
    assert resp.status_code == 200
    body = resp.json()
    assert body["listing_id"] == str(listing.id)
    assert body["unit_count"] == 2
    assert len(body["days"]) == 30
    assert body["days"][0]["date"] == timezone.localdate().isoformat()
    assert body["days"][0] == {
        "date": timezone.localdate().isoformat(),
        "free_units": 2,
        "available": True,
    }


def test_counts_only_no_counterparty_data(api, listing, hirer):
    HireFactory(listing=listing, hirer=hirer, start_date=_day(1), end_date=_day(3), confirmed=True)
    body = api.get(_url(listing)).json()
    flat = str(body)
    assert str(hirer.id) not in flat
    assert hirer.email not in flat
    day = body["days"][1]
    assert day == {"date": _day(1).isoformat(), "free_units": 1, "available": True}


def test_confirmed_hire_and_block_shape_the_days(api, supplier, listing):
    HireFactory(listing=listing, start_date=_day(1), end_date=_day(2), confirmed=True)
    HireFactory(listing=listing, start_date=_day(2), end_date=_day(2), confirmed=True)
    AvailabilityBlock.objects.create(
        listing=listing, start_date=_day(4), end_date=_day(5), created_by=supplier
    )
    days = api.get(_url(listing)).json()["days"]
    by_date = {d["date"]: d for d in days}
    assert by_date[_day(0).isoformat()]["free_units"] == 2
    assert by_date[_day(1).isoformat()]["free_units"] == 1
    assert by_date[_day(2).isoformat()] == {
        "date": _day(2).isoformat(),
        "free_units": 0,
        "available": False,
    }
    assert by_date[_day(3).isoformat()]["free_units"] == 2
    assert by_date[_day(4).isoformat()]["free_units"] == 0  # blocked zeroes the day
    assert by_date[_day(6).isoformat()]["free_units"] == 2


def test_requested_and_expired_accepted_do_not_hold(api, listing):
    HireFactory(listing=listing, start_date=_day(1), end_date=_day(3))  # requested
    HireFactory(
        listing=listing,
        start_date=_day(1),
        end_date=_day(3),
        accepted=True,
        payment_deadline=timezone.now() - dt.timedelta(minutes=1),
    )
    days = api.get(_url(listing)).json()["days"]
    assert days[1]["free_units"] == 2


def test_accepted_with_live_deadline_holds(api, listing):
    HireFactory(listing=listing, start_date=_day(1), end_date=_day(3), accepted=True)
    days = api.get(_url(listing)).json()["days"]
    assert days[1]["free_units"] == 1


# --- visibility ----------------------------------------------------------------
@pytest.mark.parametrize("status", [ListingStatus.PAUSED, ListingStatus.ARCHIVED])
def test_non_live_listing_404s(api, supplier, status):
    hidden = ListingFactory(supplier=supplier, status=status)
    assert api.get(_url(hidden)).status_code == 404


def test_suspended_supplier_404s(api, supplier, listing):
    supplier.suspended_at = timezone.now()
    supplier.save(update_fields=["suspended_at"])
    assert api.get(_url(listing)).status_code == 404


# --- window validation ---------------------------------------------------------
def test_window_cap_90_days(api, listing):
    resp = api.get(_url(listing), {"from": _day(0).isoformat(), "to": _day(120).isoformat()})
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "window_too_large"


def test_to_before_from_rejected(api, listing):
    resp = api.get(_url(listing), {"from": _day(5).isoformat(), "to": _day(2).isoformat()})
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "invalid_window"


def test_past_from_is_clamped_to_today(api, listing):
    resp = api.get(_url(listing), {"from": _day(-10).isoformat(), "to": _day(2).isoformat()})
    body = resp.json()
    assert body["from"] == timezone.localdate().isoformat()
    assert len(body["days"]) == 3


def test_entirely_past_window_yields_no_days(api, listing):
    resp = api.get(_url(listing), {"from": _day(-10).isoformat(), "to": _day(-5).isoformat()})
    assert resp.status_code == 200
    assert resp.json()["days"] == []


# --- query budget ----------------------------------------------------------------
def test_three_queries_regardless_of_window(api, listing, django_assert_max_num_queries):
    for offset in (1, 5, 9):
        HireFactory(
            listing=listing, start_date=_day(offset), end_date=_day(offset + 2), confirmed=True
        )
    with django_assert_max_num_queries(3):
        resp = api.get(_url(listing), {"from": _day(0).isoformat(), "to": _day(89).isoformat()})
    assert resp.status_code == 200
    assert len(resp.json()["days"]) == 90


# --- engine day-math vs brute force (hypothesis) --------------------------------
@settings(
    max_examples=25, deadline=None, suppress_health_check=[HealthCheck.function_scoped_fixture]
)
@given(
    holds=st.lists(
        st.tuples(st.integers(min_value=0, max_value=20), st.integers(min_value=0, max_value=6)),
        max_size=6,
    ),
    blocks=st.lists(
        st.tuples(st.integers(min_value=0, max_value=20), st.integers(min_value=0, max_value=6)),
        max_size=3,
    ),
    unit_count=st.integers(min_value=1, max_value=3),
)
def test_free_units_by_day_matches_brute_force(supplier, holds, blocks, unit_count):
    listing = ListingFactory(supplier=supplier, status=ListingStatus.LIVE, unit_count=unit_count)
    for offset, length in holds:
        HireFactory(
            listing=listing,
            start_date=_day(offset),
            end_date=_day(offset + length),
            confirmed=True,
        )
    for offset, length in blocks:
        AvailabilityBlock.objects.create(
            listing=listing,
            start_date=_day(offset),
            end_date=_day(offset + length),
            created_by=supplier,
        )
    start, end = _day(0), _day(27)
    swept = availability.free_units_by_day(listing, start, end)
    for offset in range(28):
        day = _day(offset)
        brute = availability.free_units(listing, day, day)
        assert swept[day] == brute, f"mismatch on {day}"
