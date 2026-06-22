"""Background tasks for payments (django-tasks, DB broker).

The webhook view returns 200 fast and enqueues processing here so signature
verification stays cheap and the charge-verification round-trip to Bachs happens
off the request path. The immediate backend runs this synchronously in tests.
"""

from __future__ import annotations

import structlog
from django_tasks import task

from . import bachs, services

logger = structlog.get_logger(__name__)


@task()
def process_collection_event(event_id: str) -> None:
    services.process_collection_event(event_id)


@task()
def notify_payout_paid(payout_id: str) -> None:
    """Email a supplier that their payout was paid (honours notif prefs, best-effort)."""
    from accounts.integrations import email as email_integration
    from core.money import display

    from .models import Payout

    try:
        payout = Payout.objects.select_related("supplier", "hire").get(id=payout_id)
    except Payout.DoesNotExist:
        return
    profile = getattr(payout.supplier, "supplier_profile", None)
    if profile is not None and not profile.notif_payouts:
        return
    try:
        email_integration.send_payout_paid_email(
            to=payout.supplier.email,
            amount_display=display(payout.amount),
            reference=payout.paid_ref,
            hire_ref=str(payout.hire_id),
        )
    except Exception:  # delivery is best-effort; never raise into the worker
        logger.exception("notify.payout_paid_email_failed", payout_id=payout_id)


@task()
def daily_reconciliation() -> dict:
    """Reconcile the Bachs ledger against local payments (run daily)."""
    return services.reconcile(bachs.list_ledger())
