"""Listings background tasks (django-tasks, DB broker)."""

from __future__ import annotations

import structlog
from django_tasks import task

logger = structlog.get_logger(__name__)


@task()
def sweep_orphan_photos() -> int:
    """Weekly: report public-bucket keys uploaded but never attached (>7 days).

    Wave-2 stub: the presign pipeline mints keys before attach, so abandoned
    uploads can accumulate. Deleting from R2 lands with the storage-lifecycle
    work; for now we log the candidate count so the sweep is observable.
    """
    # Attached keys are the source of truth; orphans are presigned-but-never
    # -attached objects, which we don't track yet (no upload ledger). Logged as
    # a no-op until the ledger/lifecycle policy lands.
    logger.info("listings.orphan_sweep", deleted=0)
    return 0
