"""Ops Console dashboard metrics (wave-6 §6.2)."""

from __future__ import annotations

from typing import cast

import pytest
from django.utils import timezone

from accounts.factories import UserFactory
from hires.enums import HireStatus
from hires.factories import HireFactory
from hires.models import Hire
from ops.models import ReconciliationRun
from ops.services import metrics
from payments.enums import PaymentState, PayoutKind, PayoutState
from payments.models import Payment, Payout

pytestmark = pytest.mark.django_db


def _hire(**kw) -> Hire:
    return cast(Hire, HireFactory(**kw))


def _pay(hire: Hire, *, state=PaymentState.SUCCESS) -> Payment:
    return Payment.objects.create(
        hire=hire,
        reference=f"THR-{hire.id.hex[:12]}",
        amount=hire.hire_value,
        state=state,
        paid_at=timezone.now() if state == PaymentState.SUCCESS else None,
    )


def _payout(hire: Hire, *, amount: int, state: PayoutState) -> Payout:
    return Payout.objects.create(
        hire=hire,
        supplier=hire.supplier,
        amount=amount,
        kind=PayoutKind.COMPLETION,
        state=state,
    )


def test_gmv_and_fees_sum_only_paid_hires():
    paid = _hire()
    _pay(paid)
    _hire()  # unpaid — must not contribute
    gmv, fees = metrics.gmv_and_fees()
    assert gmv == paid.hire_value
    assert fees == paid.service_fee


def test_gmv_and_fees_zero_when_no_payments():
    assert metrics.gmv_and_fees() == (0, 0)


def test_payout_liability_sums_due_and_frozen():
    # One completion payout per hire (unique constraint) → distinct hires.
    _payout(_hire(), amount=810_000_00, state=PayoutState.DUE)
    _payout(_hire(), amount=200_000_00, state=PayoutState.FROZEN)
    _payout(_hire(), amount=999_000_00, state=PayoutState.PAID)  # excluded
    assert metrics.payout_liability() == 1_010_000_00


def test_hires_by_state_zero_fills_every_status():
    _hire(status=HireStatus.REQUESTED)
    rows = {r["status"]: r["count"] for r in metrics.hires_by_state()}
    assert set(rows) == {s for s, _ in HireStatus.choices}
    assert rows[HireStatus.REQUESTED] == 1
    assert rows[HireStatus.COMPLETED] == 0


def test_new_users_window():
    UserFactory()
    assert metrics.new_users(7) >= 1


def test_queue_counts():
    _hire(status=HireStatus.IN_DISPUTE)
    counts = metrics.queue_counts()
    assert counts["disputes"] == 1
    assert set(counts) == {"verifications", "payouts", "reports", "disputes"}


def test_reconciliation_status_none_then_latest():
    assert metrics.reconciliation_status() is None
    ReconciliationRun.objects.create(checked=10, mismatch_count=0)
    latest = ReconciliationRun.objects.create(checked=12, mismatch_count=2)
    status = metrics.reconciliation_status()
    assert status["mismatch_count"] == 2
    assert status["checked"] == 12
    assert status["is_clean"] is False
    assert status["run_at"] == latest.run_at


def test_dashboard_metrics_shape():
    paid = _hire()
    _pay(paid)
    data = metrics.dashboard_metrics()
    assert data["gmv_display"].startswith("₦")
    assert data["fees_collected"] == paid.service_fee
    assert "payout_liability_display" in data
    assert isinstance(data["hires_by_state"], list)
    assert set(data["queues"]) == {"verifications", "payouts", "reports", "disputes"}
