"""Email OTP: separate channel, verifies email only, delivered by email."""

from __future__ import annotations

import pytest
from django.core import mail
from django.urls import reverse
from freezegun import freeze_time

from accounts.errors import OtpExpired, OtpResendThrottled
from accounts.models import OtpCode
from accounts.services import otp

pytestmark = pytest.mark.django_db


@pytest.fixture
def unverified(db):
    from accounts.factories import UserFactory

    return UserFactory(unverified=True)


def test_issue_email_otp_emails_a_code(unverified):
    otp.issue_email_otp(unverified)
    assert OtpCode.objects.filter(user=unverified, purpose="email_verify").count() == 1
    assert len(mail.outbox) == 1
    assert mail.outbox[0].to == [unverified.email]
    assert "verification code" in mail.outbox[0].subject.lower()


def test_verify_email_otp_marks_email_only(unverified, monkeypatch):
    monkeypatch.setattr(otp, "_generate_code", lambda: "654321")
    otp.issue_email_otp(unverified)
    otp.verify_email_otp(unverified, "654321")
    unverified.refresh_from_db()
    assert unverified.is_email_verified
    assert not unverified.is_phone_verified  # email channel only


def test_email_code_separate_from_phone_code(unverified, monkeypatch, settings):
    # Phone and email get independent codes; an email code can't verify phone.
    settings.DEBUG = True  # allow phone console fallback (no Termii in tests)
    codes = iter(["111111", "222222"])
    monkeypatch.setattr(otp, "_generate_code", lambda: next(codes))
    otp.issue_phone_otp(unverified)  # 111111
    otp.issue_email_otp(unverified)  # 222222
    from accounts.errors import OtpInvalid

    with pytest.raises(OtpInvalid):
        otp.verify_phone_otp(unverified, "222222")  # email code rejected for phone


def test_email_otp_expires(unverified, monkeypatch):
    monkeypatch.setattr(otp, "_generate_code", lambda: "654321")
    with freeze_time("2026-06-16 12:00:00"):
        otp.issue_email_otp(unverified)
    with freeze_time("2026-06-16 12:10:01"):
        with pytest.raises(OtpExpired):
            otp.verify_email_otp(unverified, "654321")


def test_email_resend_throttled_per_hour(unverified):
    with freeze_time("2026-06-16 12:00:00"):
        otp.issue_email_otp(unverified)
        otp.resend_email_otp(unverified)
        otp.resend_email_otp(unverified)
        with pytest.raises(OtpResendThrottled):
            otp.resend_email_otp(unverified)


def test_email_verify_endpoint(api, unverified, monkeypatch):
    monkeypatch.setattr(otp, "_generate_code", lambda: "654321")
    otp.issue_email_otp(unverified)
    resp = api.post(
        reverse("api:accounts:email-verify"),
        {"email": unverified.email, "code": "654321"},
        format="json",
    )
    assert resp.status_code == 200
    unverified.refresh_from_db()
    assert unverified.is_email_verified


def test_email_resend_endpoint_throttled_per_email(api, unverified):
    url = reverse("api:accounts:email-resend")
    for _ in range(3):
        assert api.post(url, {"email": unverified.email}, format="json").status_code == 200
    assert api.post(url, {"email": unverified.email}, format="json").status_code == 429
