"""Ops Console dashboard metrics (FSD §10.3 / wave-6 §6.2).

Read-only aggregates over models built in earlier waves. All money is integer
kobo; callers render via ``core.money.display``. Queries are single-pass
aggregates (no per-row Python loops, no N+1) so the dashboard stays well under
the 2s budget.
"""

from __future__ import annotations

from datetime import timedelta
from typing import Any

from django.db.models import Count, Sum
from django.utils import timezone

from accounts.enums import VerificationState
from accounts.models import User, VerificationRequest
from core.money import display
from hires.enums import HireStatus
from hires.models import Hire
from listings.enums import ReportState
from listings.models import Report
from ops.models import ReconciliationRun
from payments.enums import PaymentState, PayoutState
from payments.models import Payment, Payout


def gmv_and_fees() -> tuple[int, int]:
    """(GMV, fees collected) in kobo over hires with a SUCCESS payment.

    GMV = total value actually transacted (collected from hirers); fees = the
    Service Fee Terminal earned on those same hires (D-014: Ops-only figure).
    A hire has at most one SUCCESS payment, so this double-counts nothing.
    """
    agg = Payment.objects.filter(state=PaymentState.SUCCESS).aggregate(
        gmv=Sum("hire__hire_value"),
        fees=Sum("hire__service_fee"),
    )
    return (agg["gmv"] or 0, agg["fees"] or 0)


def payout_liability() -> int:
    """Kobo Terminal still owes suppliers: payouts that are due or frozen."""
    agg = Payout.objects.filter(state__in=[PayoutState.DUE, PayoutState.FROZEN]).aggregate(
        total=Sum("amount")
    )
    return agg["total"] or 0


def hires_by_state() -> list[dict[str, Any]]:
    """Count of hires in each status (every status present, zero-filled, ordered)."""
    counts = dict(
        Hire.objects.values_list("status").annotate(n=Count("id")).values_list("status", "n")
    )
    return [
        {"status": status, "label": label, "count": counts.get(status, 0)}
        for status, label in HireStatus.choices
    ]


def new_users(days: int = 7) -> int:
    since = timezone.now() - timedelta(days=days)
    return User.objects.filter(created_at__gte=since).count()


def queue_counts() -> dict[str, int]:
    """Pending work across the Ops queues (drives the dashboard tiles + SLA)."""
    return {
        "verifications": VerificationRequest.objects.filter(
            state=VerificationState.PENDING
        ).count(),
        "payouts": Payout.objects.filter(state=PayoutState.DUE).count(),
        "reports": Report.objects.filter(state=ReportState.OPEN).count(),
        "disputes": Hire.objects.filter(status=HireStatus.IN_DISPUTE).count(),
    }


def reconciliation_status() -> dict[str, Any] | None:
    """Last reconciliation run summary, or None if none has run yet."""
    run = ReconciliationRun.objects.order_by("-run_at").first()
    if run is None:
        return None
    return {
        "run_at": run.run_at,
        "mismatch_count": run.mismatch_count,
        "checked": run.checked,
        "is_clean": run.is_clean,
    }


def dashboard_metrics() -> dict[str, Any]:
    """Everything the Ops Console landing page renders (FSD §10.3)."""
    gmv, fees = gmv_and_fees()
    return {
        "gmv": gmv,
        "gmv_display": display(gmv),
        "fees_collected": fees,
        "fees_display": display(fees),
        "payout_liability": (liability := payout_liability()),
        "payout_liability_display": display(liability),
        "hires_by_state": hires_by_state(),
        "new_users_7d": new_users(7),
        "queues": queue_counts(),
        "reconciliation": reconciliation_status(),
    }
