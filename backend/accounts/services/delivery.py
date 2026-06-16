"""Auth notification delivery — runs inline in the API process.

OTP, welcome, and password-reset messages must not depend on a separate
django-tasks worker: production registration was succeeding while emails sat
queued (or never sent when Termii was configured but SMS didn't arrive).
"""

from __future__ import annotations

import structlog

from accounts.integrations import email as email_integration
from accounts.integrations import sms as sms_integration

logger = structlog.get_logger(__name__)


def deliver_otp(*, phone: str, code: str, email: str = "") -> None:
    """Best-effort SMS plus mandatory email when an address is known."""
    try:
        sms_integration.send_otp_sms(phone, code)
    except Exception:
        logger.exception("otp.sms_failed", phone=phone)
    if not email:
        return
    try:
        email_integration.send_otp_email(to=email, code=code)
    except Exception:
        logger.exception("otp.email_failed", email=email)


def deliver_welcome(*, to: str, full_name: str) -> None:
    try:
        email_integration.send_welcome_email(to=to, full_name=full_name)
    except Exception:
        logger.exception("welcome.email_failed", to=to)


def deliver_password_reset(*, to: str, reset_url: str) -> None:
    try:
        email_integration.send_password_reset_email(to=to, reset_url=reset_url)
    except Exception:
        logger.exception("password_reset.email_failed", to=to)
