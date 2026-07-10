"""Handover + dispute API tests (FSD §7.4, §7.3)."""

from __future__ import annotations

import datetime as dt
from typing import cast

import pytest
from django.utils import timezone

from accounts.factories import UserFactory
from hires.enums import HireStatus
from hires.factories import HireFactory
from hires.models import Hire
from listings.enums import ListingStatus
from listings.factories import ListingFactory

pytestmark = pytest.mark.django_db

HIRES = "/api/v1/hires"
PHOTOS = ["handover/a.jpg", "handover/b.jpg"]


@pytest.fixture
def listing():
    return ListingFactory(status=ListingStatus.LIVE, unit_count=1, daily_price=8_000_000)


def _hire(listing, **kw) -> Hire:
    today = timezone.localdate()
    defaults = {"start_date": today, "end_date": today + dt.timedelta(days=2)}
    defaults.update(kw)
    return cast(Hire, HireFactory(listing=listing, **defaults))


# --- handovers --------------------------------------------------------------
def test_on_hire_handover_needs_two_photos(auth, listing):
    hire = _hire(listing, confirmed=True)
    resp = auth(hire.hirer).post(
        f"{HIRES}/{hire.id}/handovers",
        {"kind": "on_hire", "photos": ["only/one.jpg"]},
        format="json",
    )
    assert resp.status_code == 400


def test_on_hire_handover_confirm_starts_the_hire(auth, listing):
    hire = _hire(listing, confirmed=True)
    submitted = auth(hire.supplier).post(
        f"{HIRES}/{hire.id}/handovers",
        {"kind": "on_hire", "photos": PHOTOS, "reading": {"hour_meter": 1200}},
        format="json",
    )
    assert submitted.status_code == 201
    handover_id = submitted.json()["id"]
    # The counterparty (hirer) confirms → hire goes On Hire.
    confirmed = auth(hire.hirer).post(f"/api/v1/handovers/{handover_id}/confirm", {}, format="json")
    assert confirmed.status_code == 200
    hire.refresh_from_db()
    assert hire.status == HireStatus.ON_HIRE


def test_submitter_cannot_confirm_own_handover(auth, listing):
    hire = _hire(listing, confirmed=True)
    submitted = auth(hire.supplier).post(
        f"{HIRES}/{hire.id}/handovers", {"kind": "on_hire", "photos": PHOTOS}, format="json"
    )
    handover_id = submitted.json()["id"]
    resp = auth(hire.supplier).post(f"/api/v1/handovers/{handover_id}/confirm", {}, format="json")
    assert resp.status_code == 403


def test_off_hire_handover_confirm_completes_the_hire(auth, listing):
    hire = _hire(listing, on_hire=True)
    submitted = auth(hire.hirer).post(
        f"{HIRES}/{hire.id}/handovers",
        {"kind": "off_hire", "photos": PHOTOS},
        format="json",
    )
    handover_id = submitted.json()["id"]
    auth(hire.supplier).post(f"/api/v1/handovers/{handover_id}/confirm", {}, format="json")
    hire.refresh_from_db()
    assert hire.status == HireStatus.COMPLETED


def test_list_handovers_returns_records_with_submitter_role(auth, listing):
    hire = _hire(listing, confirmed=True)
    auth(hire.supplier).post(
        f"{HIRES}/{hire.id}/handovers",
        {"kind": "on_hire", "photos": PHOTOS, "reading": {"hour_meter": 1200}},
        format="json",
    )
    resp = auth(hire.hirer).get(f"{HIRES}/{hire.id}/handovers")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 1
    record = body[0]
    assert record["kind"] == "on_hire"
    assert record["submitted_by_role"] == "supplier"
    assert record["confirmed_at"] is None
    assert record["reading"] == {"hour_meter": 1200}


def test_list_handovers_marks_hirer_submission(auth, listing):
    hire = _hire(listing, on_hire=True)
    auth(hire.hirer).post(
        f"{HIRES}/{hire.id}/handovers", {"kind": "off_hire", "photos": PHOTOS}, format="json"
    )
    resp = auth(hire.hirer).get(f"{HIRES}/{hire.id}/handovers")
    assert resp.json()[0]["submitted_by_role"] == "hirer"


def test_list_handovers_reflects_confirmation(auth, listing):
    hire = _hire(listing, confirmed=True)
    submitted = auth(hire.supplier).post(
        f"{HIRES}/{hire.id}/handovers", {"kind": "on_hire", "photos": PHOTOS}, format="json"
    )
    handover_id = submitted.json()["id"]
    auth(hire.hirer).post(f"/api/v1/handovers/{handover_id}/confirm", {}, format="json")
    resp = auth(hire.hirer).get(f"{HIRES}/{hire.id}/handovers")
    assert resp.json()[0]["confirmed_at"] is not None


def test_non_party_cannot_list_handovers(auth, listing):
    hire = _hire(listing, confirmed=True)
    stranger = UserFactory()
    resp = auth(stranger).get(f"{HIRES}/{hire.id}/handovers")
    assert resp.status_code == 404


# --- disputes ---------------------------------------------------------------
def test_party_raises_dispute_during_on_hire(auth, listing):
    hire = _hire(listing, on_hire=True)
    resp = auth(hire.hirer).post(
        f"{HIRES}/{hire.id}/dispute", {"reason": "asset damaged"}, format="json"
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "in_dispute"


def test_dispute_requires_reason(auth, listing):
    hire = _hire(listing, on_hire=True)
    resp = auth(hire.hirer).post(f"{HIRES}/{hire.id}/dispute", {}, format="json")
    assert resp.status_code == 400


def test_non_party_cannot_dispute(auth, listing):
    hire = _hire(listing, on_hire=True)
    stranger = UserFactory()
    resp = auth(stranger).post(f"{HIRES}/{hire.id}/dispute", {"reason": "x"}, format="json")
    assert resp.status_code == 404


def test_ops_resolves_dispute_to_completed(auth, listing):
    hire = _hire(listing, on_hire=True)
    auth(hire.hirer).post(f"{HIRES}/{hire.id}/dispute", {"reason": "x"}, format="json")
    staff = UserFactory(is_staff=True, is_superuser=True)
    resp = auth(staff).post(
        f"{HIRES}/{hire.id}/resolve-dispute", {"outcome": "complete"}, format="json"
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "completed"


def test_non_staff_cannot_resolve_dispute(auth, listing):
    hire = _hire(listing, on_hire=True)
    auth(hire.hirer).post(f"{HIRES}/{hire.id}/dispute", {"reason": "x"}, format="json")
    resp = auth(hire.hirer).post(
        f"{HIRES}/{hire.id}/resolve-dispute", {"outcome": "cancel"}, format="json"
    )
    assert resp.status_code == 403
