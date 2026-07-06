"""Refund-preview endpoint tests — §7.6 rows over the wire (Wave 7 slice 7-0).

The portal renders these figures verbatim (money is never recomputed
client-side), so every row is asserted against ``compute_refund_plan`` and the
canonical display strings.
"""

from __future__ import annotations

import datetime as dt

import pytest
from django.utils import timezone

from accounts.factories import UserFactory
from core.money import display
from hires.enums import HireStatus
from hires.factories import HireFactory
from payments.refunds import compute_refund_plan

pytestmark = pytest.mark.django_db


def _url(hire) -> str:
    return f"/api/v1/hires/{hire.id}/refund-preview"


@pytest.fixture
def confirmed_far():
    """A paid hire starting >72h out — the full-refund branch for a hirer."""
    start = timezone.localdate() + dt.timedelta(days=30)
    return HireFactory(
        status=HireStatus.CONFIRMED, start_date=start, end_date=start + dt.timedelta(days=2)
    )


@pytest.fixture
def confirmed_near():
    """A paid hire starting tomorrow — inside the 72h late-cancel window."""
    start = timezone.localdate() + dt.timedelta(days=1)
    return HireFactory(
        status=HireStatus.CONFIRMED, start_date=start, end_date=start + dt.timedelta(days=2)
    )


def test_supplier_preview_full_refund_with_strike(auth, confirmed_far):
    resp = auth(confirmed_far.supplier).get(_url(confirmed_far))
    assert resp.status_code == 200
    body = resp.json()
    assert body["cancelled_by"] == "supplier"
    assert body["kind"] == "supplier_cancel_full"
    assert body["amount"] == confirmed_far.hire_value
    assert body["withheld_day"] == 0
    assert body["processing"] == 0
    assert body["strike"] is True
    assert body["amount_display"] == display(confirmed_far.hire_value)


def test_hirer_preview_full_refund_outside_window(auth, confirmed_far):
    resp = auth(confirmed_far.hirer).get(_url(confirmed_far))
    assert resp.status_code == 200
    body = resp.json()
    assert body["cancelled_by"] == "hirer"
    assert body["kind"] == "hirer_cancel_full"
    assert body["amount"] == confirmed_far.hire_value
    assert body["strike"] is False


def test_hirer_preview_late_cancel_matches_pure_function(auth, confirmed_near):
    plan = compute_refund_plan(confirmed_near, cancelled_by="hirer")
    resp = auth(confirmed_near.hirer).get(_url(confirmed_near))
    assert resp.status_code == 200
    body = resp.json()
    assert body["kind"] == "hirer_cancel_late"
    assert body["amount"] == plan.amount
    assert body["withheld_day"] == plan.withheld_day
    # processing is the remainder — the three parts always sum to hire_value.
    assert body["amount"] + body["withheld_day"] + body["processing"] == body["hire_value"]
    assert body["amount_display"] == display(plan.amount)
    assert body["withheld_day_display"] == display(plan.withheld_day)


@pytest.mark.parametrize(
    "status",
    [HireStatus.REQUESTED, HireStatus.ACCEPTED, HireStatus.ON_HIRE, HireStatus.COMPLETED],
)
def test_preview_only_applies_to_confirmed(auth, status):
    hire = HireFactory(status=status)
    resp = auth(hire.supplier).get(_url(hire))
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "refund_not_applicable"


def test_non_party_gets_404(auth, confirmed_far):
    stranger = UserFactory()
    resp = auth(stranger).get(_url(confirmed_far))
    assert resp.status_code == 404
