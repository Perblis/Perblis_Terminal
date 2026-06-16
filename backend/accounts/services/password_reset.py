"""Password reset: request (no enumeration) and confirm (single-use).

Request always behaves identically whether or not the email exists, so it can't
be used to enumerate accounts. Confirm consumes a single-use token, sets the new
password, and bumps `token_version` to invalidate every outstanding session.
"""

from __future__ import annotations

import secrets
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from django.utils.crypto import salted_hmac

from accounts.errors import ResetTokenInvalid
from accounts.models import PasswordResetToken, User
from accounts.tasks import send_reset_email

RESET_TTL = timedelta(hours=1)


def _hash_token(raw: str) -> str:
    return salted_hmac("accounts.password-reset", raw).hexdigest()


def _reset_url(raw_token: str) -> str:
    base = settings.FRONTEND_BASE_URL.rstrip("/")
    return f"{base}/reset-password?token={raw_token}"


def request_reset(*, email: str) -> None:
    """Issue a reset token + email if the account exists. Always returns None
    so the caller can respond identically regardless."""
    user = User.objects.filter(email__iexact=email, deleted_at__isnull=True).first()
    if user is None:
        return

    raw_token = secrets.token_urlsafe(32)
    PasswordResetToken.objects.create(
        user=user,
        token_hash=_hash_token(raw_token),
        expires_at=timezone.now() + RESET_TTL,
    )
    transaction.on_commit(lambda: send_reset_email.enqueue(user.email, _reset_url(raw_token)))


@transaction.atomic
def confirm_reset(*, raw_token: str, new_password: str) -> None:
    token_hash = _hash_token(raw_token)
    token = PasswordResetToken.objects.select_for_update().filter(token_hash=token_hash).first()
    if token is None or not token.is_usable:
        raise ResetTokenInvalid()

    user = token.user
    user.set_password(new_password)
    # Invalidate all outstanding access + refresh tokens (the tv claim check).
    user.token_version = user.token_version + 1
    user.save(update_fields=["password", "token_version", "updated_at"])

    token.used_at = timezone.now()
    token.save(update_fields=["used_at", "updated_at"])

    # Any other live reset tokens for this user are now moot.
    PasswordResetToken.objects.filter(user=user, used_at__isnull=True).exclude(pk=token.pk).update(
        used_at=timezone.now()
    )


def verify_token(raw_token: str) -> bool:
    token = PasswordResetToken.objects.filter(token_hash=_hash_token(raw_token)).first()
    return bool(token and token.is_usable)
