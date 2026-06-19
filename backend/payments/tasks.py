"""Background tasks for payments (django-tasks, DB broker).

The webhook view returns 200 fast and enqueues processing here so signature
verification stays cheap and the charge-verification round-trip to Bachs happens
off the request path. The immediate backend runs this synchronously in tests.
"""

from __future__ import annotations

from django_tasks import task

from . import bachs, services


@task()
def process_collection_event(event_id: str) -> None:
    services.process_collection_event(event_id)


@task()
def daily_reconciliation() -> dict:
    """Reconcile the Bachs ledger against local payments (run daily)."""
    return services.reconcile(bachs.list_ledger())
