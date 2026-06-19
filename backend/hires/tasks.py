"""Timed hire transitions — the idempotent sweeps (TSD §3.5, FSD §7.3).

Run every ~5 minutes (a scheduler invokes ``manage.py run_hire_sweeps``, which
enqueues / calls these). Every sweep selects strictly by current status, so a
transition flips a hire out of its own candidate set — a double run is a no-op.
Each hire's transition is its own transaction, so one failure never blocks the
rest of the batch.

Reminder/notification jobs (supplier 20h nudge, hirer 60-min payment warning)
travel with the FSD §9 notification matrix in slice 4F.
"""

from __future__ import annotations

import datetime as dt

import structlog
from django.db import transaction
from django.utils import timezone
from django_tasks import task

from . import state
from .enums import ActorKind, CancelledBy, HireStatus
from .models import Hire

logger = structlog.get_logger(__name__)

# Auto-promotion windows (FSD §7.3): Confirmed → On Hire at start+24h; On Hire →
# Completed at end+48h if undisputed.
AUTO_ON_HIRE_AFTER = dt.timedelta(hours=24)
AUTO_COMPLETE_AFTER = dt.timedelta(hours=48)


def _midnight(d: dt.date) -> dt.datetime:
    return timezone.make_aware(dt.datetime.combine(d, dt.time.min), timezone.get_current_timezone())


def _safe_apply(hire: Hire, action: str, **meta) -> bool:
    try:
        with transaction.atomic():
            state.apply(hire, action, actor_kind=str(ActorKind.SYSTEM), **meta)
        return True
    except Exception:
        logger.exception("sweep.transition_failed", hire=str(hire.id), action=action)
        return False


def expire_stale_requests(now: dt.datetime | None = None) -> int:
    """Requested past its 24h expiry → Expired."""
    now = now or timezone.now()
    return sum(
        _safe_apply(h, "expire")
        for h in Hire.objects.filter(status=HireStatus.REQUESTED, request_expires_at__lt=now)
    )


def cancel_expired_payments(now: dt.datetime | None = None) -> int:
    """Accepted past its payment deadline → Cancelled(system, payment_expired)."""
    now = now or timezone.now()
    return sum(
        _safe_apply(h, "cancel", cancelled_by=str(CancelledBy.SYSTEM), reason="payment_expired")
        for h in Hire.objects.filter(status=HireStatus.ACCEPTED, payment_deadline__lt=now)
    )


def auto_start_hires(now: dt.datetime | None = None) -> int:
    """Confirmed past start+24h → On Hire (handover fallback)."""
    now = now or timezone.now()
    count = 0
    for hire in Hire.objects.filter(status=HireStatus.CONFIRMED, start_date__lte=now.date()):
        if now - _midnight(hire.start_date) >= AUTO_ON_HIRE_AFTER:
            count += _safe_apply(hire, "start")
    return count


def auto_complete_hires(now: dt.datetime | None = None) -> int:
    """On Hire past end+48h and undisputed → Completed (payout becomes due in 4F)."""
    now = now or timezone.now()
    count = 0
    for hire in Hire.objects.filter(status=HireStatus.ON_HIRE, end_date__lt=now.date()):
        # The last hired day is inclusive; the clock starts at the next midnight.
        if now - _midnight(hire.end_date + dt.timedelta(days=1)) >= AUTO_COMPLETE_AFTER:
            count += _safe_apply(hire, "complete")
    return count


def run_due_transitions(now: dt.datetime | None = None) -> dict[str, int]:
    """All four sweeps; returns per-sweep counts. Idempotent (double-run = zeros)."""
    return {
        "expired": expire_stale_requests(now),
        "payment_cancelled": cancel_expired_payments(now),
        "started": auto_start_hires(now),
        "completed": auto_complete_hires(now),
    }


@task()
def sweep_hires() -> dict[str, int]:
    result = run_due_transitions()
    logger.info("hires.sweep", **result)
    return result
