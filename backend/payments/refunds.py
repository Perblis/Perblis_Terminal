"""Refund computation — the FSD §7.6 cancellation table, pure (integer kobo).

Given a confirmed (paid) hire, who cancelled, and when, this yields the refund
to the hirer, the withheld day that becomes a supplier payout (D-015), and
whether the supplier earns a strike. No I/O — the money decisions live here and
are tested row-by-row against §7.6; ``payments.services`` applies the result.
"""

from __future__ import annotations

import datetime as dt
from dataclasses import dataclass

from django.utils import timezone

from hires.enums import CancelledBy
from hires.models import Hire

# ~1.5% processing cost withheld on a late (≤72h) hirer cancellation.
PROCESSING_BPS = 150
# The hirer-cancellation grace boundary before the hire's start.
LATE_CANCEL_WINDOW = dt.timedelta(hours=72)


@dataclass(frozen=True)
class RefundPlan:
    amount: int  # kobo refunded to the hirer
    withheld_day: int  # kobo that becomes a supplier payout (due), D-015
    strike: bool  # supplier earns a strike (supplier-cancellation)
    kind: str  # human-readable rule applied


def _start_dt(hire: Hire) -> dt.datetime:
    return timezone.make_aware(
        dt.datetime.combine(hire.start_date, dt.time.min),
        timezone.get_current_timezone(),
    )


def compute_refund_plan(
    hire: Hire, *, cancelled_by: str, now: dt.datetime | None = None
) -> RefundPlan:
    """The §7.6 outcome for a post-payment cancellation of ``hire``."""
    now = now or timezone.now()

    # Supplier cancels post-payment → hirer made whole; Terminal eats processing;
    # the supplier earns a strike. Supplier no-show maps here too.
    if cancelled_by == CancelledBy.SUPPLIER:
        return RefundPlan(
            amount=hire.hire_value, withheld_day=0, strike=True, kind="supplier_cancel_full"
        )

    # Hirer (or Ops on the hirer's behalf, or a hirer no-show) cancels.
    if _start_dt(hire) - now > LATE_CANCEL_WINDOW:
        return RefundPlan(
            amount=hire.hire_value, withheld_day=0, strike=False, kind="hirer_cancel_full"
        )

    one_day = hire.hire_value // hire.duration_days  # daily-equivalent, rounded to kobo
    processing = hire.hire_value * PROCESSING_BPS // 10_000
    refund = hire.hire_value - one_day - processing
    return RefundPlan(amount=refund, withheld_day=one_day, strike=False, kind="hirer_cancel_late")
