"""OTP issuing and verification, per channel (phone / email).

Codes are 6 digits, stored only as an HMAC-SHA256 digest keyed by SECRET_KEY,
expire after 10 minutes, allow 5 verify attempts before a new code is required,
and are capped at 3 resends per hour per channel. Phone and email are verified
independently: each has its own code, delivered only over its own channel.
"""

from __future__ import annotations

import hmac
import secrets
from datetime import timedelta

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.utils import timezone
from django.utils.crypto import salted_hmac

from accounts.enums import OtpPurpose
from accounts.errors import OtpAttemptsExceeded, OtpExpired, OtpInvalid, OtpResendThrottled
from accounts.models import OtpCode, User
from accounts.services.delivery import deliver_email_otp, deliver_phone_otp

OTP_LENGTH = 6
OTP_TTL = timedelta(minutes=10)
MAX_VERIFY_ATTEMPTS = 5
MAX_RESENDS_PER_HOUR = 3

# Canonical string values of the (str-subclass) TextChoices members.
PHONE_VERIFY = str(OtpPurpose.PHONE_VERIFY)
EMAIL_VERIFY = str(OtpPurpose.EMAIL_VERIFY)


def _generate_code() -> str:
    # E2E harness hook (Wave 7 TSD §8): a fixed code so Playwright can log in.
    # DEBUG-only, enforced loudly — never simulate trust outside dev.
    fixed = getattr(settings, "E2E_FIXED_OTP", "")
    if fixed:
        if not settings.DEBUG:
            raise ImproperlyConfigured("E2E_FIXED_OTP must never be set outside DEBUG")
        return fixed
    return f"{secrets.randbelow(10**OTP_LENGTH):0{OTP_LENGTH}d}"


def hash_code(code: str) -> str:
    # salted_hmac keys off SECRET_KEY; hex digest stored in code_hash.
    return salted_hmac("accounts.otp", code).hexdigest()


def _create_code(user: User, purpose: str) -> tuple[OtpCode, str]:
    code = _generate_code()
    otp = OtpCode.objects.create(
        user=user,
        code_hash=hash_code(code),
        purpose=purpose,
        expires_at=timezone.now() + OTP_TTL,
    )
    return otp, code


def _resend_guard(user: User, purpose: str) -> None:
    """Enforce the 3-per-hour cap (belt-and-suspenders with the view throttle)."""
    window_start = timezone.now() - timedelta(hours=1)
    recent = OtpCode.objects.filter(
        user=user, purpose=purpose, created_at__gte=window_start
    ).count()
    if recent >= MAX_RESENDS_PER_HOUR:
        raise OtpResendThrottled()


# --- Phone channel -------------------------------------------------------


def issue_phone_otp(user: User) -> OtpCode:
    otp, code = _create_code(user, PHONE_VERIFY)
    deliver_phone_otp(phone=user.phone, code=code)
    return otp


def resend_phone_otp(user: User) -> OtpCode:
    _resend_guard(user, PHONE_VERIFY)
    return issue_phone_otp(user)


def verify_phone_otp(user: User, code: str) -> None:
    _consume(user, code, PHONE_VERIFY)
    if not user.is_phone_verified:
        user.phone_verified_at = timezone.now()
        user.save(update_fields=["phone_verified_at", "updated_at"])


# --- Email channel -------------------------------------------------------


def issue_email_otp(user: User) -> OtpCode:
    otp, code = _create_code(user, EMAIL_VERIFY)
    deliver_email_otp(email=user.email, code=code)
    return otp


def resend_email_otp(user: User) -> OtpCode:
    _resend_guard(user, EMAIL_VERIFY)
    return issue_email_otp(user)


def verify_email_otp(user: User, code: str) -> None:
    _consume(user, code, EMAIL_VERIFY)
    if not user.is_email_verified:
        user.email_verified_at = timezone.now()
        user.save(update_fields=["email_verified_at", "updated_at"])


# --- Shared verification core --------------------------------------------


def _consume(user: User, code: str, purpose: str) -> None:
    """Validate a code against the user's latest unconsumed OTP for `purpose`.

    On success the OTP is consumed. A wrong code increments the attempt counter;
    once attempts hit the cap the code is unusable and a new one is required.
    """
    otp = (
        OtpCode.objects.filter(user=user, purpose=purpose, consumed_at__isnull=True)
        .order_by("-created_at")
        .first()
    )
    if otp is None:
        raise OtpInvalid()
    if otp.attempts >= MAX_VERIFY_ATTEMPTS:
        raise OtpAttemptsExceeded()
    if otp.is_expired:
        raise OtpExpired()

    if hmac.compare_digest(otp.code_hash, hash_code(code)):
        otp.consumed_at = timezone.now()
        otp.save(update_fields=["consumed_at", "updated_at"])
        return

    otp.attempts += 1
    otp.save(update_fields=["attempts", "updated_at"])
    if otp.attempts >= MAX_VERIFY_ATTEMPTS:
        raise OtpAttemptsExceeded()
    raise OtpInvalid()
