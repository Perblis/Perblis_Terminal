"""Hire request/accept/decline/cancel API tests (FSD §7.1–§7.2, §4.1, D-014)."""

from __future__ import annotations

import datetime as dt

import pytest
from django.utils import timezone

from accounts.factories import UserFactory
from hires.enums import CancelledBy, HireStatus
from hires.models import Hire
from listings.enums import ListingStatus
from listings.factories import ListingFactory

pytestmark = pytest.mark.django_db

HIRES = "/api/v1/hires"


@pytest.fixture
def supplier():
    return UserFactory(is_supplier=True, account_level="verified")


@pytest.fixture
def listing(supplier):
    return ListingFactory(
        supplier=supplier, status=ListingStatus.LIVE, daily_price=8_000_000, unit_count=1
    )


def _dates(days=3, offset=7):
    start = timezone.localdate() + dt.timedelta(days=offset)
    return start.isoformat(), (start + dt.timedelta(days=days - 1)).isoformat()


def _request_body(listing, days=3):
    start, end = _dates(days)
    return {
        "listing_id": str(listing.id),
        "start_date": start,
        "end_date": end,
        "terms_accepted": True,
    }


# --- create -----------------------------------------------------------------
def test_hirer_creates_request_and_sees_no_fee(auth, hirer, listing):
    resp = auth(hirer).post(HIRES, _request_body(listing), format="json")
    assert resp.status_code == 201
    body = resp.json()
    assert body["status"] == "requested"
    assert body["hire_value"] == 24_000_000  # ₦240k, 3 days @ ₦80k
    # D-014: the hirer never sees the fee or payout.
    assert "service_fee" not in body
    assert "payout_amount" not in body
    assert "fee_basis" not in body


def test_terms_must_be_accepted(auth, hirer, listing):
    body = _request_body(listing)
    body["terms_accepted"] = False
    resp = auth(hirer).post(HIRES, body, format="json")
    assert resp.status_code == 400


def test_basic_cap_blocks_large_request(auth, listing):
    basic = UserFactory(account_level="basic")  # not verified
    resp = auth(basic).post(HIRES, _request_body(listing, days=4), format="json")  # ₦320k
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "basic_cap_exceeded"


def test_verified_hirer_exceeds_basic_cap(auth, listing):
    verified = UserFactory(account_level="verified")
    resp = auth(verified).post(HIRES, _request_body(listing, days=4), format="json")
    assert resp.status_code == 201


def test_cannot_hire_own_listing(auth, supplier, listing):
    resp = auth(supplier).post(HIRES, _request_body(listing), format="json")
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "cannot_hire_own_listing"


def test_unavailable_dates_rejected(auth, hirer, listing):
    # Confirm a hire over the same dates → the unit is taken.
    start, end = _dates()
    Hire.objects.create(
        listing=listing,
        hirer=UserFactory(),
        supplier=listing.supplier,
        start_date=start,
        end_date=end,
        duration_days=3,
        scheme="daily",
        fee_basis="x",
        hire_value=1,
        service_fee=1,
        payout_amount=0,
        status=HireStatus.CONFIRMED,
        request_expires_at=timezone.now(),
    )
    resp = auth(hirer).post(HIRES, _request_body(listing), format="json")
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "availability_conflict"


# --- accept / decline / cancel ---------------------------------------------
def _make_request(auth, hirer, listing) -> str:
    return auth(hirer).post(HIRES, _request_body(listing), format="json").json()["id"]


def test_supplier_accepts(auth, hirer, supplier, listing):
    hire_id = _make_request(auth, hirer, listing)
    resp = auth(supplier).post(f"{HIRES}/{hire_id}/accept", {}, format="json")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "accepted"
    assert body["payment_deadline"] is not None
    # The supplier view DOES show the fee breakdown (D-014 inverse).
    assert "service_fee" in body and "payout_amount" in body and "fee_basis" in body


def test_hirer_cannot_accept(auth, hirer, listing):
    hire_id = _make_request(auth, hirer, listing)
    resp = auth(hirer).post(f"{HIRES}/{hire_id}/accept", {}, format="json")
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "transition_not_permitted"


def test_decline_requires_reason(auth, hirer, supplier, listing):
    hire_id = _make_request(auth, hirer, listing)
    assert auth(supplier).post(f"{HIRES}/{hire_id}/decline", {}, format="json").status_code == 400
    resp = auth(supplier).post(
        f"{HIRES}/{hire_id}/decline", {"reason": "asset down for service"}, format="json"
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "declined"


def test_hirer_cancels_request(auth, hirer, listing):
    hire_id = _make_request(auth, hirer, listing)
    resp = auth(hirer).post(f"{HIRES}/{hire_id}/cancel", {}, format="json")
    assert resp.status_code == 200
    assert resp.json()["status"] == "cancelled"
    assert Hire.objects.get(id=hire_id).cancelled_by == CancelledBy.HIRER


def test_supplier_cannot_cancel_request(auth, hirer, supplier, listing):
    # From Requested a supplier must Decline, not Cancel.
    hire_id = _make_request(auth, hirer, listing)
    resp = auth(supplier).post(f"{HIRES}/{hire_id}/cancel", {}, format="json")
    assert resp.status_code == 403


# --- list / detail / D-014 --------------------------------------------------
def test_list_filters_by_role(auth, hirer, supplier, listing):
    _make_request(auth, hirer, listing)
    as_hirer = auth(hirer).get(HIRES, {"role": "hirer"}).json()["results"]
    assert len(as_hirer) == 1
    as_supplier = auth(supplier).get(HIRES, {"role": "supplier"}).json()["results"]
    assert len(as_supplier) == 1


def test_detail_d014_both_directions(auth, hirer, supplier, listing):
    hire_id = _make_request(auth, hirer, listing)
    hirer_view = auth(hirer).get(f"{HIRES}/{hire_id}").json()
    assert "service_fee" not in hirer_view and "payout_amount" not in hirer_view
    assert "events" in hirer_view and len(hirer_view["events"]) >= 1
    supplier_view = auth(supplier).get(f"{HIRES}/{hire_id}").json()
    assert supplier_view["service_fee"] == 2_880_000  # 12% of ₦240k
    assert supplier_view["payout_amount"] == 21_120_000


def test_detail_hidden_from_non_parties(auth, hirer, listing):
    hire_id = _make_request(auth, hirer, listing)
    stranger = UserFactory()
    assert auth(stranger).get(f"{HIRES}/{hire_id}").status_code == 404


def test_cannot_request_non_live_listing(auth, hirer, supplier):
    draft = ListingFactory(supplier=supplier, status=ListingStatus.DRAFT)
    resp = auth(hirer).post(HIRES, _request_body(draft), format="json")
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "listing_not_hireable"


def test_detail_404_for_unknown_hire(auth, hirer):
    resp = auth(hirer).get(f"{HIRES}/00000000-0000-0000-0000-000000000000")
    assert resp.status_code == 404
