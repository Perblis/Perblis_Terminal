"""SMS delivery via Termii, with a console fallback for keyless dev.

Commandment 10: the OTP flow is always real (code generated, hashed, stored,
throttled) — only the *transport* degrades when no key is configured. We never
auto-verify; we just print the code so a developer can complete the flow.
"""

from __future__ import annotations

import httpx
import structlog
from django.conf import settings

logger = structlog.get_logger(__name__)

TERMII_SEND_URL = "https://api.ng.termii.com/api/sms/send"


def send_sms(phone: str, message: str) -> bool:
    """Send an SMS. Returns True if handed to a provider, False if console-only."""
    if not settings.TERMII_API_KEY:
        logger.info("sms.console_fallback", phone=phone, message=message)
        # Make the OTP visible to a developer running without keys.
        print(f"[DEV SMS] to {phone}: {message}")  # noqa: T201 - intentional dev aid
        return False

    payload = {
        "to": phone,
        "from": settings.TERMII_SENDER_ID or "Terminal",
        "sms": message,
        "type": "plain",
        "channel": "generic",
        "api_key": settings.TERMII_API_KEY,
    }
    resp = httpx.post(TERMII_SEND_URL, json=payload, timeout=10.0)
    resp.raise_for_status()
    logger.info("sms.sent", phone=phone)
    return True


def send_otp_sms(phone: str, code: str) -> bool:
    return send_sms(
        phone,
        f"Your Terminal verification code is {code}. It expires in 10 minutes.",
    )
