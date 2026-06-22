"""Ops Console security logging (TSD §7: admin login IP logging).

Structlog lines only — no new model. The append-only domain audit trail lives
in ``hire_events`` (domain actions) and Django ``LogEntry`` (admin object
changes); this adds the authentication-event trail for the Ops Console.
"""

from __future__ import annotations

import structlog
from django.contrib.auth.signals import user_logged_in, user_login_failed
from django.dispatch import receiver

logger = structlog.get_logger("ops.security")


def _client_ip(request) -> str | None:
    if request is None:
        return None
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded:
        # Left-most hop is the originating client (Railway sets this).
        return forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


def _is_admin_request(request) -> bool:
    return request is not None and request.path.startswith("/admin/")


@receiver(user_logged_in)
def log_staff_login(sender, request, user, **kwargs) -> None:
    """Record successful Ops Console sign-ins with their source IP."""
    if getattr(user, "is_staff", False) and _is_admin_request(request):
        logger.info(
            "ops.admin_login",
            user_id=str(getattr(user, "pk", "")),
            email=getattr(user, "email", ""),
            ip=_client_ip(request),
        )


@receiver(user_login_failed)
def log_admin_login_failed(sender, credentials, request=None, **kwargs) -> None:
    """Record failed Ops Console sign-in attempts (security trail)."""
    if _is_admin_request(request):
        logger.warning(
            "ops.admin_login_failed",
            email=credentials.get("username", ""),
            ip=_client_ip(request),
        )
