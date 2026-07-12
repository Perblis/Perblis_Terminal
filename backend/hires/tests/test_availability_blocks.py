"""Supplier availability-block tests (D-024): CRUD, auth, and engine fold-in."""

from __future__ import annotations

import datetime as dt

import pytest
from django.utils import timezone

from hires import availability, errors, state
from hires.enums import ActorKind, HireStatus
from hires.factories import HireFactory
from hires.models import AvailabilityBlock
from listings.enums import ListingStatus
from listings.factories import ListingFactory

pytestmark = pytest.mark.django_db


def _blocks_url(listing) -> str:
    return f"/api/v1/listings/{listing.id}/availability-blocks"


def _block_url(block) -> str:
    return f"/api/v1/availability-blocks/{block.id}"


@pytest.fixture
def listing(supplier):
    return ListingFactory(
        supplier=supplier, status=ListingStatus.LIVE, daily_price=8_000_000, unit_count=1
    )


def _range(offset=7, days=3) -> tuple[dt.date, dt.date]:
    start = timezone.localdate() + dt.timedelta(days=offset)
    return start, start + dt.timedelta(days=days - 1)


def _body(offset=7, days=3, **extra) -> dict:
    start, end = _range(offset, days)
    return {"start_date": start.isoformat(), "end_date": end.isoformat(), **extra}


# --- CRUD + auth --------------------------------------------------------------
def test_supplier_creates_and_lists_block(auth, supplier, listing):
    client = auth(supplier)
    resp = client.post(_blocks_url(listing), _body(reason="maintenance"), format="json")
    assert resp.status_code == 201
    body = resp.json()
    assert body["listing_id"] == str(listing.id)
    assert body["reason"] == "maintenance"

    listed = client.get(_blocks_url(listing)).json()
    assert [b["id"] for b in listed["results"]] == [body["id"]]


def test_supplier_deletes_block(auth, supplier, listing):
    client = auth(supplier)
    block_id = client.post(_blocks_url(listing), _body(), format="json").json()["id"]
    resp = client.delete(f"/api/v1/availability-blocks/{block_id}")
    assert resp.status_code == 204
    assert not AvailabilityBlock.objects.filter(id=block_id).exists()


def test_other_supplier_404s(auth, supplier2, listing):
    client = auth(supplier2)
    assert client.get(_blocks_url(listing)).status_code == 404
    assert client.post(_blocks_url(listing), _body(), format="json").status_code == 404


def test_other_supplier_cannot_delete(auth, supplier, supplier2, listing):
    start, end = _range()
    block = AvailabilityBlock.objects.create(
        listing=listing, start_date=start, end_date=end, created_by=supplier
    )
    assert auth(supplier2).delete(_block_url(block)).status_code == 404
    assert AvailabilityBlock.objects.filter(id=block.id).exists()


def test_hirer_cannot_touch_blocks(auth, hirer, listing):
    client = auth(hirer)
    assert client.get(_blocks_url(listing)).status_code == 403
    assert client.post(_blocks_url(listing), _body(), format="json").status_code == 403


def test_anonymous_401(api, listing):
    assert api.get(_blocks_url(listing)).status_code == 401


# --- validation ---------------------------------------------------------------
@pytest.mark.parametrize(
    "start_offset,days",
    [
        (7, 0),  # end before start
        (-3, 5),  # starts in the past
        (7, 400),  # longer than a year
    ],
)
def test_invalid_ranges_rejected(auth, supplier, listing, start_offset, days):
    start = timezone.localdate() + dt.timedelta(days=start_offset)
    end = start + dt.timedelta(days=days - 1)
    resp = auth(supplier).post(
        _blocks_url(listing),
        {"start_date": start.isoformat(), "end_date": end.isoformat()},
        format="json",
    )
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "block_invalid_range"


def test_overlapping_own_blocks_allowed(auth, supplier, listing):
    client = auth(supplier)
    assert client.post(_blocks_url(listing), _body(), format="json").status_code == 201
    assert client.post(_blocks_url(listing), _body(), format="json").status_code == 201


# --- engine fold-in (D-024: a block is a hard hold) ----------------------------
@pytest.fixture
def blocked_range(supplier, listing):
    start, end = _range()
    AvailabilityBlock.objects.create(
        listing=listing, start_date=start, end_date=end, created_by=supplier
    )
    return start, end


def test_block_zeroes_public_availability(listing, blocked_range):
    start, end = blocked_range
    assert availability.is_available(listing, start, end) is False
    assert availability.free_units(listing, start, end) == 0
    assert availability.can_confirm(listing, start, end) is False


def test_block_is_whole_listing_even_multi_unit(supplier, blocked_range):
    listing = ListingFactory(supplier=supplier, status=ListingStatus.LIVE, unit_count=3)
    start, end = blocked_range
    AvailabilityBlock.objects.create(
        listing=listing, start_date=start, end_date=end, created_by=supplier
    )
    assert availability.free_units(listing, start, end) == 0


def test_non_overlapping_block_has_no_effect(supplier, listing):
    start, end = _range(offset=7)
    b_start, b_end = _range(offset=30)
    AvailabilityBlock.objects.create(
        listing=listing, start_date=b_start, end_date=b_end, created_by=supplier
    )
    assert availability.is_available(listing, start, end) is True


def test_touching_boundary_dates_conflict(supplier, listing):
    # The overlap predicate is inclusive: a block ending the day a hire starts
    # still conflicts (dates are whole days).
    start, end = _range(offset=7, days=3)
    AvailabilityBlock.objects.create(
        listing=listing,
        start_date=start - dt.timedelta(days=2),
        end_date=start,
        created_by=supplier,
    )
    assert availability.is_available(listing, start, end) is False


def test_accept_into_blocked_range_conflicts(supplier, listing, blocked_range):
    start, end = blocked_range
    hire = HireFactory(listing=listing, start_date=start, end_date=end)
    with pytest.raises(errors.AvailabilityConflict):
        state.apply(hire, "accept", actor=supplier, actor_kind=str(ActorKind.USER))
    hire.refresh_from_db()
    assert hire.status == HireStatus.REQUESTED


def test_pay_into_blocked_range_conflicts(supplier, listing):
    start, end = _range()
    hire = HireFactory(listing=listing, start_date=start, end_date=end, accepted=True)
    AvailabilityBlock.objects.create(  # block lands after acceptance
        listing=listing, start_date=start, end_date=end, created_by=supplier
    )
    with pytest.raises(errors.AvailabilityConflict):
        state.apply(hire, "pay", actor=None, actor_kind=str(ActorKind.SYSTEM))


def test_availability_map_dims_blocked_listing(supplier, listing):
    today = timezone.localdate()
    AvailabilityBlock.objects.create(
        listing=listing, start_date=today, end_date=today, created_by=supplier
    )
    clear = ListingFactory(supplier=supplier, status=ListingStatus.LIVE, unit_count=1)
    result = availability.availability_map([listing, clear])
    assert result[listing.id] is False
    assert result[clear.id] is True


def test_hire_request_into_blocked_range_conflicts(auth, hirer, listing, blocked_range):
    start, end = blocked_range
    resp = auth(hirer).post(
        "/api/v1/hires",
        {
            "listing_id": str(listing.id),
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
            "terms_accepted": True,
        },
        format="json",
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "availability_conflict"
