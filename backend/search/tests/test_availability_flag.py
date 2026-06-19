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
