"""Auth notification delivery — runs inline in the API process.

Phone and email OTPs travel over *separate* channels and are never crossed:
the phone code goes only by SMS, the email code only by email. This keeps each
verification honest — a code delivered by email can't prove phone ownership.

Delivery runs inline (no separate django-tasks worker) so a registration that
returns 201 has actually attempted to send. SMS delivery is loud, not silent:
if the code can't be sent it raises `OtpDeliveryFailed` rather than pretending.
"""

from __future__ import annotations

import structlog
from django.conf import settings

from accounts.errors import OtpDeliveryFailed
from accounts.integrations import email as email_integration
from accounts.integrations import sms as sms_integration

logger = structlog.get_logger(__name__)


def deliver_phone_otp(*, phone: str, code: str) -> None:
    """Send the phone OTP by SMS only. Never email it.

    - SMS provider configured + send fails  -> loud failure (OtpDeliveryFailed).
    - No SMS provider in prod                -> misconfiguration, loud failure.
    - No SMS provider in dev (DEBUG)         -> console fallback (visible), ok.
    """
    try:
        sent_via_provider = sms_integration.send_otp_sms(phone, code)
    except Exception as exc:
        logger.exception("otp.sms_failed", phone=phone)
        raise OtpDeliveryFailed() from exc
    if not sent_via_provider and not settings.DEBUG:
        # Console-only delivery is acceptable in dev; in prod it means Termii is
        # unconfigured — refuse rather than silently drop the phone OTP.
        logger.error("otp.sms_unconfigured_in_prod", phone=phone)
        raise OtpDeliveryFailed()


def deliver_email_otp(*, email: str, code: str) -> None:
    """Send the email OTP by email only."""
    try:
        email_integration.send_otp_email(to=email, code=code)
    except Exception as exc:
        logger.exception("otp.email_failed", email=email)
        raise OtpDeliveryFailed() from exc


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
