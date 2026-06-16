"""User registration.

Creates the account (Hirer by default, Basic level), captures NDPR consent,
issues phone + email verification OTPs (each over its own channel), and sends a
welcome email. All side-effecting writes live here, not in the view.
"""

from __future__ import annotations

import structlog
from django.db import transaction
from django.utils import timezone

from accounts.errors import OtpDeliveryFailed
from accounts.models import User
from accounts.services.delivery import deliver_welcome
from accounts.services.otp import issue_email_otp, issue_phone_otp

logger = structlog.get_logger(__name__)


def _issue_initial_otps(user: User) -> None:
    """Best-effort initial sends. The account already exists; a channel that
    fails here is logged loudly and the user can resend (the explicit resend
    endpoints surface failures). We never let one channel's failure lose the
    other or the registration."""
    for label, issue in (("phone", issue_phone_otp), ("email", issue_email_otp)):
        try:
            issue(user)
        except OtpDeliveryFailed:
            logger.error("register.otp_delivery_failed", channel=label, user_id=str(user.id))
        except Exception:
            logger.exception("register.otp_unexpected_error", channel=label, user_id=str(user.id))


@transaction.atomic
def register_user(
    *,
    full_name: str,
    email: str,
    phone: str,
    password: str,
) -> User:
    now = timezone.now()
    user = User.objects.create_user(
        email=email,
        phone=phone,
        password=password,
        full_name=full_name,
        is_hirer=True,
        is_supplier=False,
        tos_accepted_at=now,
        privacy_accepted_at=now,
    )
    # Deliver after the row commits so nothing races an uncommitted user.
    transaction.on_commit(lambda: _issue_initial_otps(user))
    transaction.on_commit(lambda: deliver_welcome(to=user.email, full_name=user.full_name))
    return user
