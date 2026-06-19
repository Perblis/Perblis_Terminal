"""Refund tests — the FSD §7.6 table row-by-row, strikes, and money conservation."""

from __future__ import annotations

import datetime as dt
from typing import cast

import pytest
from django.utils import timezone

from hires.enums import CancelledBy, HireStatus
from hires.factories import HireFactory
from hires.models import Hire
from listings.enums import ListingStatus
from listings.factories import ListingFactory
from payments import refunds, services
from payments.enums import PaymentState, RefundState
from payments.models import Payment
from suppliers.factories import SupplierProfileFactory

pytestmark = pytest.mark.django_db


def _confirmed_hire(*, start_offset_days: int, duration: int = 5, daily=8_000_000) -> Hire:
    listing = ListingFactory(status=ListingStatus.LIVE, unit_count=1, daily_price=daily)
    start = timezone.localdate() + dt.timedelta(days=start_offset_days)
    hire = cast(
        Hire,
        HireFactory(
            listing=listing,
            start_date=start,
            end_date=start + dt.timedelta(days=duration - 1),
            confirmed=True,
        ),
    )
    # A matching successful payment so refund/invariant math has money to move.
    Payment.objects.create(
        hire=hire,
        reference=f"THR-{hire.id.hex[:12]}-1",
        amount=hire.hire_value,
        charge_id="chg_x",
        state=PaymentState.SUCCESS,
        paid_at=timezone.now(),
    )
    return hire


# --- §7.6 rows (compute_refund_plan, pure) ----------------------------------
def test_hirer_cancel_far_out_is_full_refund():
    hire = _confirmed_hire(start_offset_days=30)
    plan = refunds.compute_refund_plan(hire, cancelled_by=str(CancelledBy.HIRER))
    assert plan.amount == hire.hire_value
    assert plan.withheld_day == 0 and plan.strike is False


def test_hirer_cancel_within_72h_withholds_one_day_and_processing():
    # 5-day hire @ ₦80k/day = ₦400k; start in 2 days (≤72h).
    hire = _confirmed_hire(start_offset_days=2, duration=5)
    plan = refunds.compute_refund_plan(hire, cancelled_by=str(CancelledBy.HIRER))
    one_day = hire.hire_value // 5
    processing = hire.hire_value * 150 // 10_000
    assert plan.amount == hire.hire_value - one_day - processing
    assert plan.withheld_day == one_day
    assert plan.strike is False


def test_supplier_cancel_is_full_refund_plus_strike():
    hire = _confirmed_hire(start_offset_days=2)  # timing irrelevant for supplier-cancel
    plan = refunds.compute_refund_plan(hire, cancelled_by=str(CancelledBy.SUPPLIER))
    assert plan.amount == hire.hire_value
    assert plan.strike is True


# --- issue_refund (records + strike) ----------------------------------------
def test_issue_refund_records_refund():
    hire = _confirmed_hire(start_offset_days=30)
    refund = services.issue_refund(hire, cancelled_by=CancelledBy.HIRER, reason="changed plans")
    assert refund.amount == hire.hire_value
    # Keyless dev → no provider → PENDING (Ops retries).
    assert refund.state in (RefundState.PENDING, RefundState.COMPLETED)


def test_supplier_cancel_increments_strike():
    hire = _confirmed_hire(start_offset_days=2)
    SupplierProfileFactory(user=hire.supplier)
    services.issue_refund(hire, cancelled_by=CancelledBy.SUPPLIER, reason="asset down")
    hire.supplier.supplier_profile.refresh_from_db()
    assert hire.supplier.supplier_profile.strike_count == 1


# --- money conservation -----------------------------------------------------
def test_full_refund_retains_nothing():
    hire = _confirmed_hire(start_offset_days=30)
    services.issue_refund(hire, cancelled_by=CancelledBy.HIRER, reason="x")
    assert services.retained(hire) == 0  # collected − refunded == 0


def test_late_cancel_conserves_money():
    hire = _confirmed_hire(start_offset_days=2, duration=5)
    services.issue_refund(hire, cancelled_by=CancelledBy.HIRER, reason="x")
    one_day = hire.hire_value // 5
    processing = hire.hire_value * 150 // 10_000
    # Until 4F pays the withheld day, Terminal holds (processing + withheld day).
    assert services.retained(hire) == one_day + processing
    # And it exactly matches what was not refunded.
    assert services.retained(hire) == hire.hire_value - (hire.hire_value - one_day - processing)


# --- end-to-end: cancelling a paid hire issues the refund -------------------
def test_cancel_confirmed_hire_issues_refund(django_capture_on_commit_callbacks):
    from hires import services as hire_services

    hire = _confirmed_hire(start_offset_days=30)
    with django_capture_on_commit_callbacks(execute=True):
        hire_services.cancel_hire(user=hire.hirer, hire_id=hire.id, reason="changed plans")
    hire.refresh_from_db()
    assert hire.status == HireStatus.CANCELLED
    assert hire.refunds.count() == 1
    assert hire.refunds.first().amount == hire.hire_value
