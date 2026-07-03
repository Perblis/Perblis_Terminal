"""Supplier stats, event feed, and hire-list date window (Wave 7 slice 7-0)."""

from __future__ import annotations

import datetime as dt

import pytest
from django.utils import timezone

from accounts.factories import UserFactory
from hires.enums import ActorKind, HireStatus
from hires.factories import HireFactory
from hires.models import HireEvent
from listings.enums import ListingStatus
from listings.factories import ListingFactory, ListingPhotoFactory

pytestmark = pytest.mark.django_db

STATS = "/api/v1/hires/stats"
EVENTS = "/api/v1/hires/events"
HIRES = "/api/v1/hires"


@pytest.fixture
def supplier():
    return UserFactory(is_supplier=True, account_level="verified")


@pytest.fixture
def listing(supplier):
    return ListingFactory(supplier=supplier, status=ListingStatus.LIVE, unit_count=5)


# --- stats -------------------------------------------------------------------
def test_stats_counts_by_status_and_nearest_expiry(auth, supplier, listing):
    soon = timezone.now() + dt.timedelta(hours=2)
    later = timezone.now() + dt.timedelta(hours=20)
    HireFactory(listing=listing, status=HireStatus.REQUESTED, request_expires_at=later)
    HireFactory(listing=listing, status=HireStatus.REQUESTED, request_expires_at=soon)
    HireFactory(listing=listing, status=HireStatus.ON_HIRE)
    HireFactory(listing=listing, status=HireStatus.COMPLETED)
    # Another supplier's hire never leaks into the counts.
    HireFactory(status=HireStatus.REQUESTED)

    resp = auth(supplier).get(STATS)
    assert resp.status_code == 200
    body = resp.json()
    assert body["by_status"]["requested"] == 2
    assert body["by_status"]["on_hire"] == 1
    assert body["by_status"]["completed"] == 1
    assert body["needs_response"] == 2
    # Nearest expiry is the soonest pending request.
    assert body["nearest_request_expires_at"].startswith(soon.isoformat()[:16])


def test_stats_requires_supplier(auth, hirer):
    assert auth(hirer).get(STATS).status_code == 403


def test_stats_empty_supplier_gets_zeros(auth, supplier):
    resp = auth(supplier).get(STATS)
    assert resp.status_code == 200
    body = resp.json()
    assert set(body["by_status"]) == set(HireStatus.values)
    assert all(v == 0 for v in body["by_status"].values())
    assert body["nearest_request_expires_at"] is None


# --- events feed ---------------------------------------------------------------
def test_events_feed_is_supplier_scoped_and_newest_first(auth, supplier, listing):
    mine = HireFactory(listing=listing, status=HireStatus.REQUESTED)
    HireEvent.objects.create(
        hire=mine, actor_kind=ActorKind.USER, from_status="", to_status=HireStatus.REQUESTED
    )
    HireEvent.objects.create(
        hire=mine,
        actor_kind=ActorKind.USER,
        from_status=HireStatus.REQUESTED,
        to_status=HireStatus.ACCEPTED,
    )
    other = HireFactory(status=HireStatus.REQUESTED)  # different supplier
    HireEvent.objects.create(
        hire=other, actor_kind=ActorKind.USER, from_status="", to_status=HireStatus.REQUESTED
    )

    resp = auth(supplier).get(EVENTS)
    assert resp.status_code == 200
    rows = resp.json()["results"]
    assert len(rows) == 2
    assert rows[0]["to_status"] == "accepted"  # newest first
    assert rows[0]["hire_id"] == str(mine.id)
    assert rows[0]["listing_title"] == mine.listing.title


def test_events_requires_supplier(auth, hirer):
    assert auth(hirer).get(EVENTS).status_code == 403


# --- hire list: window filter + additive fields -------------------------------
def test_hire_list_date_window_overlap(auth, supplier, listing):
    today = timezone.localdate()

    def _mk(offset, days):
        start = today + dt.timedelta(days=offset)
        return HireFactory(
            listing=listing,
            status=HireStatus.CONFIRMED,
            start_date=start,
            end_date=start + dt.timedelta(days=days - 1),
        )

    inside = _mk(5, 3)
    straddles = _mk(9, 5)  # overlaps the window edge
    outside = _mk(30, 3)

    window_from = (today + dt.timedelta(days=4)).isoformat()
    window_to = (today + dt.timedelta(days=10)).isoformat()
    resp = auth(supplier).get(f"{HIRES}?role=supplier&from={window_from}&to={window_to}")
    assert resp.status_code == 200
    ids = {row["id"] for row in resp.json()["results"]}
    assert str(inside.id) in ids
    assert str(straddles.id) in ids
    assert str(outside.id) not in ids


def test_hire_list_rejects_bad_dates(auth, supplier):
    resp = auth(supplier).get(f"{HIRES}?from=not-a-date")
    assert resp.status_code == 400


def test_hire_rows_carry_yard_and_cover_photo(auth, supplier, listing):
    photo = ListingPhotoFactory(listing=listing, is_cover=True)
    hire = HireFactory(listing=listing, yard=None)
    resp = auth(supplier).get(f"{HIRES}?role=supplier")
    row = next(r for r in resp.json()["results"] if r["id"] == str(hire.id))
    assert row["yard_id"] is None
    assert photo.r2_key in (row["listing_photo"] or "")
