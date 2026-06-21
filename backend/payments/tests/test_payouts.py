"""Payout lifecycle, completion money invariant, and reconciliation (FSD §3.2, §3.6)."""

from __future__ import annotations

import datetime as dt
from typing import cast

import pytest
from django.utils import timezone

from hires import services as hire_services
from hires.enums import CancelledBy, HireStatus
from hires.factories import HireFactory
from hires.models import Hire
from listings.enums import ListingStatus
from listings.factories import ListingFactory
from payments import services
from payments.enums import PaymentState, PayoutKind, PayoutState
from payments.models import Payment, Payout

pytestmark = pytest.mark.django_db


def _paid_hire(*, status=HireStatus.ON_HIRE, duration=5, start_offset=-10) -> Hire:
    listing = ListingFactory(status=ListingStatus.LIVE, unit_count=1, daily_price=8_000_000)
    start = timezone.localdate() + dt.timedelta(days=start_offset)
    hire = cast(
        Hire,
        HireFactory(
            listing=listing,
            start_date=start,
            end_date=start + dt.timedelta(days=duration - 1),
            status=status,
        ),
    )
    Payment.objects.create(
        hire=hire,
        reference=f"THR-{hire.id.hex[:12]}-1",
        amount=hire.hire_value,
        charge_id="chg_x",
        state=PaymentState.SUCCESS,
        paid_at=timezone.now(),
    )
    return hire


# --- payout lifecycle -------------------------------------------------------
def test_completion_creates_due_payout():
    hire = _paid_hire(status=HireStatus.COMPLETED)
    payout = services.create_completion_payout(hire)
    assert payout.state == PayoutState.DUE
    assert payout.amount == hire.payout_amount
    assert payout.supplier_id == hire.supplier_id


def test_completion_payout_is_idempotent():
    hire = _paid_hire(status=HireStatus.COMPLETED)
    services.create_completion_payout(hire)
    services.create_completion_payout(hire)
    assert Payout.objects.filter(hire=hire, kind=PayoutKind.COMPLETION).count() == 1


def test_dispute_freezes_due_payout():
    hire = _paid_hire(status=HireStatus.COMPLETED)
    services.create_completion_payout(hire)
    services.freeze_payouts(hire)
    assert hire.payouts.get(kind=PayoutKind.COMPLETION).state == PayoutState.FROZEN


def test_mark_payout_paid_records_reference():
    hire = _paid_hire(status=HireStatus.COMPLETED)
    payout = services.create_completion_payout(hire)
    services.mark_payout_paid(payout, reference="TRX-001")
    payout.refresh_from_db()
    assert payout.state == PayoutState.PAID and payout.paid_ref == "TRX-001"


# --- completion money invariant ---------------------------------------------
def test_completion_invariant_balances_once_paid():
    hire = _paid_hire(status=HireStatus.COMPLETED)
    payout = services.create_completion_payout(hire)
    # Before the payout settles, Terminal holds the whole collected amount.
    assert services.retained(hire) == hire.hire_value
    services.mark_payout_paid(payout, reference="TRX-002")
    # collected − refunded − paid_out ≡ service_fee (Terminal's revenue). The
    # full identity collected − refunded − paid_out − service_fee == 0 holds.
    assert services.retained(hire) == hire.service_fee
    assert services.retained(hire) - hire.service_fee == 0


def test_late_cancel_creates_withheld_day_payout():
    # ≤72h hirer cancellation → withheld-day supplier payout (D-015).
    hire = _paid_hire(status=HireStatus.CONFIRMED, duration=5, start_offset=2)
    services.issue_refund(hire, cancelled_by=str(CancelledBy.HIRER), reason="late")
    withheld = hire.payouts.get(kind=PayoutKind.WITHHELD_DAY)
    assert withheld.state == PayoutState.DUE
    assert withheld.amount == hire.hire_value // hire.duration_days


# --- reconciliation ---------------------------------------------------------
def test_reconcile_clean_when_ledger_matches():
    hire = _paid_hire(status=HireStatus.COMPLETED)
    payment = hire.payments.first()
    # The gateway normalises ledger rows to {reference, amount_kobo, succeeded}.
    ledger = [{"reference": payment.reference, "amount_kobo": hire.hire_value, "succeeded": True}]
    report = services.reconcile(ledger)
    assert report["mismatches"] == []


def test_reconcile_flags_amount_mismatch():
    hire = _paid_hire(status=HireStatus.COMPLETED)
    payment = hire.payments.first()
    ledger = [{"reference": payment.reference, "amount_kobo": 1, "succeeded": True}]
    report = services.reconcile(ledger)
    assert report["mismatches"] == [{"reference": payment.reference, "issue": "amount_mismatch"}]


def test_reconcile_flags_missing_in_ledger():
    hire = _paid_hire(status=HireStatus.COMPLETED)
    payment = hire.payments.first()
    report = services.reconcile([])  # ledger empty
    assert report["mismatches"] == [{"reference": payment.reference, "issue": "missing_in_ledger"}]


# --- completion wiring (end to end via the resolve-dispute path) ------------
def test_resolve_dispute_complete_queues_payout():
    hire = _paid_hire(status=HireStatus.ON_HIRE)
    hire_services.raise_dispute(user=hire.hirer, hire_id=hire.id, reason="x")
    from accounts.factories import UserFactory

    staff = UserFactory(is_staff=True, is_superuser=True)
    hire_services.resolve_dispute(user=staff, hire_id=hire.id, outcome="complete")
    hire.refresh_from_db()
    assert hire.status == HireStatus.COMPLETED
    assert hire.payouts.get(kind=PayoutKind.COMPLETION).state == PayoutState.DUE
