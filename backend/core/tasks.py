"""Background tasks owned by core.

`heartbeat` is a no-op task whose only job is to prove the django-tasks
DB-broker round-trip works end to end: enqueue here, execute in the worker
(`manage.py db_worker`). No Redis, no Celery (D-010).
"""

from __future__ import annotations

import structlog
from django_tasks import task

logger = structlog.get_logger(__name__)


@task()
def heartbeat(note: str = "ok") -> str:
    """Log and return a heartbeat marker, proving the broker round-trip."""
    logger.info("heartbeat", note=note)
    return f"heartbeat:{note}"
