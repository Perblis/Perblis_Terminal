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
from .enums import ActorKind, CancelledBy, HandoverKind, HireStatus
from .models import HandoverRecord, Hire

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
    from payments.services import create_completion_payout

    count = 0
    for hire in Hire.objects.filter(status=HireStatus.ON_HIRE, end_date__lt=now.date()):
        # The last hired day is inclusive; the clock starts at the next midnight.
        if now - _midnight(hire.end_date + dt.timedelta(days=1)) >= AUTO_COMPLETE_AFTER:
            if _safe_apply(hire, "complete"):
                count += 1
                hire.refresh_from_db()
                create_completion_payout(hire)
    return count


def run_due_transitions(now: dt.datetime | None = None) -> dict[str, int]:
    """All four sweeps; returns per-sweep counts. Idempotent (double-run = zeros)."""
    return {
        "expired": expire_stale_requests(now),
        "payment_cancelled": cancel_expired_payments(now),
        "started": auto_start_hires(now),
        "completed": auto_complete_hires(now),
    }


# Reminder windows (~5-min sweep cadence → each hire is nudged once). Supplier
# nudge ~20h into a 24h request; hirer warning ~60m before the payment deadline.
_NUDGE_LEAD = dt.timedelta(hours=4)
_WARN_LEAD = dt.timedelta(minutes=60)
_WINDOW = dt.timedelta(minutes=5)


def send_due_reminders(now: dt.datetime | None = None) -> dict[str, int]:
    """Supplier 20h nudge + hirer 60-min payment warning (FSD §9). Idempotent by window."""
    from . import notifications

    now = now or timezone.now()
    nudged = 0
    for hire in Hire.objects.filter(
        status=HireStatus.REQUESTED,
        request_expires_at__gte=now + _NUDGE_LEAD - _WINDOW,
        request_expires_at__lt=now + _NUDGE_LEAD,
    ):
        notifications.notify_supplier_nudge(hire)
        nudged += 1
    warned = 0
    for hire in Hire.objects.filter(
        status=HireStatus.ACCEPTED,
        payment_deadline__gte=now + _WARN_LEAD - _WINDOW,
        payment_deadline__lt=now + _WARN_LEAD,
    ):
        notifications.notify_payment_warning(hire)
        warned += 1
    return {"nudged": nudged, "payment_warned": warned}


@task()
def sweep_hires() -> dict[str, int]:
    result = run_due_transitions()
    result.update(send_due_reminders())
    logger.info("hires.sweep", **result)
    return result


# --- handover-photo retention (D-026) -----------------------------------------
# Photo objects age out of storage this long after the off-hire handover is
# confirmed; the record rows are retained forever (the transaction history).
HANDOVER_PHOTO_RETENTION = dt.timedelta(days=90)


def purge_due_handover_photos(now: dt.datetime | None = None) -> dict[str, int]:
    """Delete handover-photo objects whose D-026 retention has elapsed.

    Eligible: hires that are **Completed** (an In-Dispute hire freezes its
    evidence) whose *confirmed* off-hire handover is ≥90 days old. All of the
    hire's handover records purge together (on-hire evidence ages out with the
    off-hire one). Idempotent: purged records carry ``photos_purged_at`` and
    leave the candidate set; a storage failure leaves the record unpurged for
    the next run.
    """
    from core import media

    now = now or timezone.now()
    cutoff = now - HANDOVER_PHOTO_RETENTION
    due_hires = Hire.objects.filter(
        status=HireStatus.COMPLETED,
        handovers__kind=HandoverKind.OFF_HIRE,
        handovers__confirmed_at__lte=cutoff,
    ).values_list("id", flat=True)
    records = HandoverRecord.objects.filter(
        hire_id__in=due_hires, photos_purged_at__isnull=True
    ).exclude(photos=[])

    purged = objects_deleted = errors = 0
    for record in records:
        try:
            for key in record.photos:
                media.delete_private_file(key)  # missing key = no-op (idempotent)
                objects_deleted += 1
            record.photos = []
            record.photos_purged_at = now
            record.save(update_fields=["photos", "photos_purged_at", "updated_at"])
            purged += 1
        except Exception:  # one bad object never stalls the sweep
            logger.exception("hires.handover_purge_failed", record=str(record.id))
            errors += 1
    result = {"purged": purged, "objects_deleted": objects_deleted, "errors": errors}
    logger.info("hires.handover_purge", **result)
    return result


@task()
def purge_handover_photos() -> dict[str, int]:
    return purge_due_handover_photos()
