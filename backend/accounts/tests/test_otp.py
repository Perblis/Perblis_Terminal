"""Phone OTP: expiry, resend throttle, attempt exhaustion, hash-at-rest."""

from __future__ import annotations

import pytest
from freezegun import freeze_time

from accounts.errors import (
    OtpAttemptsExceeded,
    OtpExpired,
    OtpInvalid,
    OtpResendThrottled,
)
from accounts.models import OtpCode
from accounts.services import otp

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def _dev_sms(settings):
    # Simulate a dev box (no Termii): phone OTP falls back to console instead of
    # raising OtpDeliveryFailed. Delivery itself is exercised in
    # test_integrations_fallback.
    settings.DEBUG = True


@pytest.fixture
def unverified(db):
    from accounts.factories import UserFactory

    return UserFactory(unverified=True)


def test_otp_hashed_at_rest(unverified, monkeypatch):
    monkeypatch.setattr(otp, "_generate_code", lambda: "123456")
    code = otp.issue_phone_otp(unverified)
    assert code.code_hash != "123456"
    assert "123456" not in code.code_hash
    assert OtpCode.objects.filter(code_hash="123456").count() == 0


def test_verify_success_marks_phone_verified(unverified, monkeypatch):
    monkeypatch.setattr(otp, "_generate_code", lambda: "123456")
    otp.issue_phone_otp(unverified)
    otp.verify_phone_otp(unverified, "123456")
    unverified.refresh_from_db()
    assert unverified.is_phone_verified
    assert not unverified.is_email_verified  # phone channel only


def test_otp_expires_after_10_minutes(unverified, monkeypatch):
    monkeypatch.setattr(otp, "_generate_code", lambda: "123456")
    with freeze_time("2026-06-16 12:00:00"):
        otp.issue_phone_otp(unverified)
    with freeze_time("2026-06-16 12:10:01"):
        with pytest.raises(OtpExpired):
            otp.verify_phone_otp(unverified, "123456")


def test_resend_throttled_after_three_per_hour(unverified):
    with freeze_time("2026-06-16 12:00:00"):
        otp.issue_phone_otp(unverified)  # 1
        otp.resend_phone_otp(unverified)  # 2
        otp.resend_phone_otp(unverified)  # 3
        with pytest.raises(OtpResendThrottled):
            otp.resend_phone_otp(unverified)  # 4 -> blocked
    with freeze_time("2026-06-16 13:00:01"):
        otp.resend_phone_otp(unverified)


def test_attempt_exhaustion_requires_new_code(unverified, monkeypatch):
    monkeypatch.setattr(otp, "_generate_code", lambda: "123456")
    otp.issue_phone_otp(unverified)
    for _ in range(4):
        with pytest.raises(OtpInvalid):
            otp.verify_phone_otp(unverified, "000000")
    with pytest.raises(OtpAttemptsExceeded):
        otp.verify_phone_otp(unverified, "000000")
    # Even the correct code no longer works — a new code is required.
    with pytest.raises(OtpAttemptsExceeded):
        otp.verify_phone_otp(unverified, "123456")


def test_resend_endpoint_throttled_per_phone(api, unverified):
    from django.urls import reverse

    url = reverse("api:accounts:otp-resend")
    for _ in range(3):
        assert api.post(url, {"phone": unverified.phone}, format="json").status_code == 200
    # 4th within the hour is blocked by the per-phone ScopedRateThrottle.
    assert api.post(url, {"phone": unverified.phone}, format="json").status_code == 429
