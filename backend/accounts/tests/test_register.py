"""Registration: account creation, consent, OTP issuance, welcome email."""

from __future__ import annotations

import pytest
from django.core import mail
from django.urls import reverse

from accounts.models import AccountLevel, OtpCode, User

pytestmark = pytest.mark.django_db


def _payload(**over):
    data = {
        "full_name": "Ada Obi",
        "email": "ada@example.com",
        "phone": "08031234567",
        "password": "Terminal123",
        "accept_tos": True,
        "accept_privacy": True,
    }
    data.update(over)
    return data


def test_register_creates_hirer_basic_with_consent(api, django_capture_on_commit_callbacks):
    url = reverse("api:accounts:register")
    with django_capture_on_commit_callbacks(execute=True):
        resp = api.post(url, _payload(), format="json")

    assert resp.status_code == 201
    user = User.objects.get(email="ada@example.com")
    assert user.is_hirer and not user.is_supplier
    assert user.account_level == AccountLevel.BASIC
    assert user.phone == "+2348031234567"  # normalised to E.164
    assert user.tos_accepted_at is not None and user.privacy_accepted_at is not None
    assert not user.is_phone_verified
    assert not user.is_email_verified
    # A phone OTP and an email OTP are issued (one per channel), plus the
    # welcome email. The phone code is delivered by SMS, never email.
    assert OtpCode.objects.filter(user=user, purpose="phone_verify").count() == 1
    assert OtpCode.objects.filter(user=user, purpose="email_verify").count() == 1
    assert any("Welcome" in m.subject for m in mail.outbox)
    assert any("verification code" in m.subject.lower() for m in mail.outbox)


def test_register_rejects_duplicate_email(api, user):
    resp = api.post(reverse("api:accounts:register"), _payload(email=user.email), format="json")
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "validation_error"


def test_register_rejects_weak_password(api):
    resp = api.post(reverse("api:accounts:register"), _payload(password="weak"), format="json")
    assert resp.status_code == 400


def test_register_requires_consent(api):
    resp = api.post(reverse("api:accounts:register"), _payload(accept_tos=False), format="json")
    assert resp.status_code == 400
