"""Supplier payouts endpoint tests (Wave 7 slice 7-0, P2/F11).

Scoping (payout figures are supplier-confidential, D-014), the summary block's
month windows, and the queue/frozen split.
"""

from __future__ import annotations

import datetime as dt

import pytest
from django.utils import timezone

from accounts.factories import UserFactory
from core.money import display
from hires.enums import HireStatus
from hires.factories import HireFactory
from payments.enums import PayoutKind, PayoutState
from payments.models import Payout

pytestmark = pytest.mark.django_db

PAYOUTS = "/api/v1/payments/payouts"


@pytest.fixture
def supplier():
    return UserFactory(is_supplier=True, account_level="verified")


def _payout(supplier, *, amount, state, kind=PayoutKind.COMPLETION, paid_at=None, paid_ref=""):
    hire = HireFactory(
        listing__supplier=supplier, listing__status="live", status=HireStatus.COMPLETED
    )
    return Payout.objects.create(
        hire=hire,
        supplier=supplier,
        amount=amount,
        kind=kind,
        state=state,
        paid_at=paid_at,
        paid_ref=paid_ref,
    )


def test_requires_supplier(auth, hirer):
    assert auth(hirer).get(PAYOUTS).status_code == 403


def test_rows_are_supplier_scoped(auth, supplier):
    mine = _payout(supplier, amount=5_000_000, state=PayoutState.DUE)
    other = _payout(UserFactory(is_supplier=True), amount=7_000_000, state=PayoutState.DUE)

    resp = auth(supplier).get(PAYOUTS)
    assert resp.status_code == 200
    ids = {row["id"] for row in resp.json()["results"]}
    assert str(mine.id) in ids
    assert str(other.id) not in ids


def test_summary_queue_frozen_and_month_windows(auth, supplier):
    _payout(supplier, amount=1_000_000, state=PayoutState.PENDING)
    _payout(supplier, amount=2_000_000, state=PayoutState.DUE)
    _payout(supplier, amount=4_000_000, state=PayoutState.FROZEN)
    paid = _payout(
        supplier,
        amount=8_000_000,
        state=PayoutState.PAID,
        paid_at=timezone.now(),
        paid_ref="PO-E2E-1",
    )
    # A payout settled (and paid) last month — counts toward the delta, not this month.
    month_start = timezone.localtime().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    prev = _payout(
        supplier,
        amount=16_000_000,
        state=PayoutState.PAID,
        paid_at=month_start - dt.timedelta(days=2),
    )
    Payout.objects.filter(pk=prev.pk).update(created_at=month_start - dt.timedelta(days=2))

    body = auth(supplier).get(PAYOUTS).json()
    summary = body["summary"]
    assert summary["queued_total"] == 3_000_000  # pending + due; frozen excluded
    assert summary["frozen_total"] == 4_000_000
    assert summary["earned_this_month"] == 15_000_000  # everything created this month
    assert summary["earned_prev_month"] == 16_000_000
    assert summary["queued_total_display"] == display(3_000_000)
    assert summary["last_paid"]["paid_ref"] == "PO-E2E-1"
    assert summary["last_paid"]["amount"] == paid.amount


def test_summary_empty_supplier(auth, supplier):
    body = auth(supplier).get(PAYOUTS).json()
    assert body["results"] == []
    assert body["summary"]["queued_total"] == 0
    assert body["summary"]["last_paid"] is None


def test_row_shape(auth, supplier):
    payout = _payout(supplier, amount=5_000_000, state=PayoutState.DUE)
    row = auth(supplier).get(PAYOUTS).json()["results"][0]
    assert row["id"] == str(payout.id)
    assert row["hire_id"] == str(payout.hire_id)
    assert row["listing_title"] == payout.hire.listing.title
    assert row["amount_display"] == display(5_000_000)
    assert row["state"] == "due"
