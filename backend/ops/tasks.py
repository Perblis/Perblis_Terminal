"""Ops background tasks (django-tasks, DB broker).

Scheduled via management commands invoked by Railway cron (mirrors
``hires.run_hire_sweeps``); every task is idempotent enough to re-run safely.
"""

from __future__ import annotations

import structlog
from django.conf import settings
from django_tasks import task

logger = structlog.get_logger(__name__)


@task()
def send_weekly_digest() -> dict:
    """Build and email the founder the weekly metrics digest (FSD §6.8)."""
    from accounts.integrations import email as email_integration
    from ops.services.digest import build_digest, render_digest

    digest = build_digest()
    subject, body = render_digest(digest)
    recipient = settings.OPS_DIGEST_RECIPIENT or settings.DEFAULT_FROM_EMAIL
    try:
        email_integration.send_ops_email(to=recipient, subject=subject, body=body)
        sent = True
    except Exception:  # delivery best-effort; never crash the worker
        logger.exception("ops.weekly_digest_email_failed")
        sent = False
    ably = digest["ably"]
    return {"sent": sent, "ably_alert": bool(ably and ably["alert"])}
