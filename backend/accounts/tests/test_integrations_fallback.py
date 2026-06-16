"""Integrations degrade to dev fallbacks without keys — and never auto-trust."""

from __future__ import annotations

import pytest
from django.core import mail
from django.test import override_settings

from accounts.integrations import email as email_integration
from accounts.integrations import media
from accounts.integrations import sms as sms_integration

pytestmark = pytest.mark.django_db


@override_settings(TERMII_API_KEY="")
def test_sms_console_fallback_returns_false(capsys):
    sent_via_provider = sms_integration.send_otp_sms("+2348031234567", "123456")
    assert sent_via_provider is False
    assert "123456" in capsys.readouterr().out


@override_settings(TERMII_API_KEY="", RESEND_API_KEY="")
def test_dispatch_otp_emails_when_sms_unavailable():
    from accounts.tasks import dispatch_otp_sms

    dispatch_otp_sms.call("+2348031234567", "654321", "hirer@example.com")
    assert len(mail.outbox) == 1
    assert "654321" in mail.outbox[0].body
    assert mail.outbox[0].to == ["hirer@example.com"]


@override_settings(RESEND_API_KEY="")
def test_email_uses_django_backend_without_key():
    via_resend = email_integration.send_welcome_email(to="a@example.com", full_name="A")
    assert via_resend is False
    assert len(mail.outbox) == 1


@override_settings(PRIVATE_MEDIA_BACKEND="local")
def test_private_media_local_roundtrip_and_signed_url(tmp_path, settings):
    settings.MEDIA_ROOT = tmp_path
    key = "verification/u/r/doc.pdf"
    media.store_private_file(key, b"%PDF-1.4 data", "application/pdf")
    assert media.read_private_file(key) == b"%PDF-1.4 data"
    url = media.presign_get(key)
    # The presigned URL points at the Ops-only stream view, not a public path.
    assert "/api/v1/private-doc" in url
    assert "t=" in url
    # The token round-trips back to the key.
    token = url.split("t=", 1)[1]
    assert media.unsign_local_token(token) == key
