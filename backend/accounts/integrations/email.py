"""Transactional email via Resend, with Django's email backend as fallback.

When `RESEND_API_KEY` is set we call Resend's HTTP API; otherwise we send
through Django's configured `EMAIL_BACKEND` (Mailpit SMTP in dev, console if
unreachable). Either way an email is genuinely dispatched — only the carrier
changes.
"""

from __future__ import annotations

import httpx
import structlog
from django.conf import settings
from django.core.mail import send_mail

logger = structlog.get_logger(__name__)

RESEND_SEND_URL = "https://api.resend.com/emails"


def send_email(*, to: str, subject: str, body: str) -> bool:
    """Send a plain-text email. Returns True if sent via Resend, else via Django."""
    if not settings.RESEND_API_KEY:
        send_mail(
            subject=subject,
            message=body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[to],
            fail_silently=False,
        )
        logger.info("email.sent_via_django", to=to, subject=subject)
        return False

    resp = httpx.post(
        RESEND_SEND_URL,
        headers={"Authorization": f"Bearer {settings.RESEND_API_KEY}"},
        json={
            "from": settings.DEFAULT_FROM_EMAIL,
            "to": [to],
            "subject": subject,
            "text": body,
        },
        timeout=10.0,
    )
    resp.raise_for_status()
    logger.info("email.sent_via_resend", to=to, subject=subject)
    return True


def send_welcome_email(*, to: str, full_name: str) -> bool:
    return send_email(
        to=to,
        subject="Welcome to Terminal",
        body=(
            f"Hi {full_name},\n\n"
            "Welcome to Terminal. Verify your phone with the code we just sent "
            "to finish setting up your account.\n"
        ),
    )


def send_password_reset_email(*, to: str, reset_url: str) -> bool:
    return send_email(
        to=to,
        subject="Reset your Terminal password",
        body=(
            "We received a request to reset your Terminal password.\n\n"
            f"Use this link within the next hour:\n{reset_url}\n\n"
            "If you didn't request this, you can ignore this email.\n"
        ),
    )


def send_verification_outcome_email(
    *, to: str, kind: str, approved: bool, reason: str = ""
) -> bool:
    if approved:
        body = f"Your {kind} verification has been approved.\n"
    else:
        body = (
            f"Your {kind} verification could not be approved.\n\n"
            f"Reason: {reason}\n\nYou can submit a new request at any time.\n"
        )
    return send_email(to=to, subject="Terminal verification update", body=body)
