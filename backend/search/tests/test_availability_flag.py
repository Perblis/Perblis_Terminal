"""Wave 4 closes the Wave 3 ``available`` stub: search now reflects real holds."""

from __future__ import annotations

import datetime as dt

import pytest
from django.utils import timezone

from hires.factories import HireFactory
from listings.enums import ListingStatus
from listings.factories import ListingFactory

pytestmark = pytest.mark.django_db

# A viewport around the ListingFactory default pin (3.3792, 6.4433).
BBOX = "3.30,6.38,3.45,6.50"


def _live_listing(**kw):
    return ListingFactory(
        status=ListingStatus.LIVE,
        supplier__account_level="verified",
        **kw,
    )


def _solo(body, listing_id):
    return next(s for s in body["listings"] if s["id"] == str(listing_id))


def test_listing_with_no_holds_is_available(api):
    listing = _live_listing()
    body = api.get("/api/v1/search/map", {"bbox": BBOX}).json()
    assert _solo(body, listing.id)["available"] is True


def test_fully_held_listing_is_unavailable(api):
    listing = _live_listing(unit_count=1)
    today = timezone.localdate()
    HireFactory(
        listing=listing,
        start_date=today - dt.timedelta(days=1),
        end_date=today + dt.timedelta(days=1),
        confirmed=True,
    )
    body = api.get("/api/v1/search/map", {"bbox": BBOX}).json()
    assert _solo(body, listing.id)["available"] is False


def test_partially_held_multi_unit_is_still_available(api):
    listing = _live_listing(unit_count=2)
    today = timezone.localdate()
    HireFactory(
        listing=listing,
        start_date=today - dt.timedelta(days=1),
        end_date=today + dt.timedelta(days=1),
        confirmed=True,
    )
    body = api.get("/api/v1/search/map", {"bbox": BBOX}).json()
    assert _solo(body, listing.id)["available"] is True  # 1 of 2 free


# --- date_from/date_to: 'available' reflects the hire window ------------------
def _day(offset: int) -> str:
    return (timezone.localdate() + dt.timedelta(days=offset)).isoformat()


def _map(api, **extra):
    return api.get("/api/v1/search/map", {"bbox": BBOX, **extra})


def test_future_hold_flips_flag_only_with_dates(api):
    listing = _live_listing(unit_count=1)
    today = timezone.localdate()
    HireFactory(
        listing=listing,
        start_date=today + dt.timedelta(days=10),
        end_date=today + dt.timedelta(days=12),
        confirmed=True,
    )
    # Today's flag: free.
    assert _solo(_map(api).json(), listing.id)["available"] is True
    # The held window: unavailable.
    body = _map(api, date_from=_day(10), date_to=_day(12)).json()
    assert _solo(body, listing.id)["available"] is False
    # A clear window: available.
    body = _map(api, date_from=_day(20), date_to=_day(22)).json()
    assert _solo(body, listing.id)["available"] is True


def test_full_range_semantics_partial_overlap_counts(api):
    """Any hold overlapping any part of the window dims the pin (= is_available)."""
    listing = _live_listing(unit_count=1)
    today = timezone.localdate()
    HireFactory(
        listing=listing,
        start_date=today + dt.timedelta(days=12),
        end_date=today + dt.timedelta(days=13),
        confirmed=True,
    )
    body = _map(api, date_from=_day(10), date_to=_day(20)).json()
    assert _solo(body, listing.id)["available"] is False


def test_block_dims_pin_for_window(api):
    from hires.models import AvailabilityBlock

    listing = _live_listing(unit_count=3)
    today = timezone.localdate()
    AvailabilityBlock.objects.create(
        listing=listing,
        start_date=today + dt.timedelta(days=5),
        end_date=today + dt.timedelta(days=6),
        created_by=listing.supplier,
    )
    body = _map(api, date_from=_day(5), date_to=_day(6)).json()
    assert _solo(body, listing.id)["available"] is False


def test_yard_embedded_summaries_honor_window(api):
    from suppliers.factories import YardFactory

    yard = YardFactory()
    held = _live_listing(unit_count=1, yard=yard, supplier=yard.supplier)
    free = _live_listing(unit_count=1, yard=yard, supplier=yard.supplier)
    today = timezone.localdate()
    HireFactory(
        listing=held,
        start_date=today + dt.timedelta(days=10),
        end_date=today + dt.timedelta(days=12),
        confirmed=True,
    )
    body = _map(api, date_from=_day(10), date_to=_day(12)).json()
    summaries = {ln["id"]: ln["available"] for y in body["yards"] for ln in y["listings"]}
    assert summaries[str(held.id)] is False
    assert summaries[str(free.id)] is True


def test_list_endpoint_honours_window(api):
    listing = _live_listing(unit_count=1)
    today = timezone.localdate()
    HireFactory(
        listing=listing,
        start_date=today + dt.timedelta(days=10),
        end_date=today + dt.timedelta(days=12),
        confirmed=True,
    )
    body = api.get(
        "/api/v1/search/list", {"bbox": BBOX, "date_from": _day(10), "date_to": _day(12)}
    ).json()
    row = next(r for r in body["results"] if r["id"] == str(listing.id))
    assert row["available"] is False


@pytest.mark.parametrize(
    "params",
    [
        {"date_from": "2030-01-01"},  # one without the other
        {"date_from": "2030-02-01", "date_to": "2030-01-01"},  # reversed
        {"date_from": "2030-01-01", "date_to": "2030-06-01"},  # >90 days
    ],
)
def test_bad_date_windows_rejected(api, params):
    assert _map(api, **params).status_code == 400


def test_past_window_clamped_to_today(api):
    listing = _live_listing(unit_count=1)
    resp = _map(api, date_from=_day(-10), date_to=_day(1))
    assert resp.status_code == 200
    assert _solo(resp.json(), listing.id)["available"] is True


def test_query_count_unchanged_with_dates(api, django_assert_max_num_queries):
    for _ in range(4):
        _live_listing(unit_count=1)
    with django_assert_max_num_queries(8):
        resp = _map(api, date_from=_day(5), date_to=_day(8))
    assert resp.status_code == 200
