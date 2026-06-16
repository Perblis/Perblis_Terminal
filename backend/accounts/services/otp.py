"""OTP issuing and verification.

Codes are 6 digits, stored only as an HMAC-SHA256 digest keyed by SECRET_KEY,
expire after 10 minutes, allow 5 verify attempts before a new code is required,
and are capped at 3 resends per hour. The tiny code space makes hash *cost*
irrelevant — expiry, the attempt cap, and the send throttle are the defence,
so a fast keyed hash is correct here.
"""

from __future__ import annotations

import hmac
import secrets
from datetime import timedelta

from django.utils import timezone
from django.utils.crypto import salted_hmac

from accounts.enums import OtpPurpose
from accounts.errors import OtpAttemptsExceeded, OtpExpired, OtpInvalid, OtpResendThrottled
from accounts.models import OtpCode, User
from accounts.tasks import dispatch_otp_sms

OTP_LENGTH = 6
OTP_TTL = timedelta(minutes=10)
MAX_VERIFY_ATTEMPTS = 5
MAX_RESENDS_PER_HOUR = 3
# str() of the (str-subclass) TextChoices member — the canonical column value.
DEFAULT_OTP_PURPOSE = str(OtpPurpose.PHONE_VERIFY)


def _generate_code() -> str:
    return f"{secrets.randbelow(10**OTP_LENGTH):0{OTP_LENGTH}d}"


def hash_code(code: str) -> str:
    # salted_hmac keys off SECRET_KEY; hex digest stored in code_hash.
    return salted_hmac("accounts.otp", code).hexdigest()


def issue_otp(user: User, purpose: str = DEFAULT_OTP_PURPOSE) -> OtpCode:
    """Create a fresh code, persist its digest, and dispatch it by SMS."""
    code = _generate_code()
    otp = OtpCode.objects.create(
        user=user,
        code_hash=hash_code(code),
        purpose=purpose,
        expires_at=timezone.now() + OTP_TTL,
    )
    dispatch_otp_sms.enqueue(user.phone, code)
    return otp


def resend_otp(user: User, purpose: str = DEFAULT_OTP_PURPOSE) -> OtpCode:
    """Issue a new code, enforcing the 3-per-hour cap (belt-and-suspenders with
    the per-phone ScopedRateThrottle on the view)."""
    window_start = timezone.now() - timedelta(hours=1)
    recent = OtpCode.objects.filter(
        user=user, purpose=purpose, created_at__gte=window_start
    ).count()
    if recent >= MAX_RESENDS_PER_HOUR:
        raise OtpResendThrottled()
    return issue_otp(user, purpose)


def verify_otp(user: User, code: str, purpose: str = DEFAULT_OTP_PURPOSE) -> None:
    """Verify a code against the user's latest unconsumed OTP.

    On success the OTP is consumed and the user's phone is marked verified. A
    wrong code increments the attempt counter; once attempts hit the cap the
    code is unusable and a new one must be requested.
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
        if not user.is_phone_verified:
            user.phone_verified_at = timezone.now()
            user.save(update_fields=["phone_verified_at", "updated_at"])
        return

    otp.attempts += 1
    otp.save(update_fields=["attempts", "updated_at"])
    if otp.attempts >= MAX_VERIFY_ATTEMPTS:
        raise OtpAttemptsExceeded()
    raise OtpInvalid()
