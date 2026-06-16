"""Password reset: no enumeration, single-use, 1-hour expiry, session kill."""

from __future__ import annotations

import re

import pytest
from django.core import mail
from django.urls import reverse
from freezegun import freeze_time

from accounts.models import PasswordResetToken
from accounts.services import password_reset

pytestmark = pytest.mark.django_db


def _request(api, email):
    return api.post(reverse("api:accounts:password-reset"), {"email": email}, format="json")


def test_request_no_enumeration_identical_response(api, user):
    known = _request(api, user.email)
    unknown = _request(api, "nobody@example.com")
    assert known.status_code == unknown.status_code == 200
    assert known.json() == unknown.json()
    # A token was created only for the real account.
    assert PasswordResetToken.objects.filter(user=user).count() == 1


def test_reset_token_is_single_use(api, user, django_capture_on_commit_callbacks):
    with django_capture_on_commit_callbacks(execute=True):
        _request(api, user.email)
    raw = _extract_token()
    url = reverse("api:accounts:password-reset-confirm")
    first = api.post(url, {"token": raw, "new_password": "Brandnew123"}, format="json")
    assert first.status_code == 200
    second = api.post(url, {"token": raw, "new_password": "Another123"}, format="json")
    assert second.status_code == 400
    assert second.json()["error"]["code"] == "reset_token_invalid"


def test_reset_token_expires_after_one_hour(api, user, django_capture_on_commit_callbacks):
    with freeze_time("2026-06-16 12:00:00"):
        with django_capture_on_commit_callbacks(execute=True):
            _request(api, user.email)
        raw = _extract_token()
    with freeze_time("2026-06-16 13:00:01"):
        resp = api.post(
            reverse("api:accounts:password-reset-confirm"),
            {"token": raw, "new_password": "Brandnew123"},
            format="json",
        )
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "reset_token_invalid"


def test_confirm_invalidates_sessions(user):
    # Issue a token via the service, confirm, and assert token_version bumped.
    before = user.token_version
    password_reset.request_reset(email=user.email)
    raw = _last_raw_token(user)
    password_reset.confirm_reset(raw_token=raw, new_password="Brandnew123")
    user.refresh_from_db()
    assert user.token_version == before + 1
    assert user.check_password("Brandnew123")


def _extract_token() -> str:
    body = mail.outbox[-1].body
    match = re.search(r"token=([\w\-]+)", body)
    assert match is not None
    return match.group(1)


def _last_raw_token(user) -> str:
    # The service only stores the hash; reconstruct by issuing with a known
    # token is not possible, so tests that need the raw token go through the
    # email path. Here we instead drive confirm via a freshly minted token.
    from accounts.services.password_reset import _hash_token

    raw = "known-raw-token-value"
    token = PasswordResetToken.objects.filter(user=user, used_at__isnull=True).latest("created_at")
    token.token_hash = _hash_token(raw)
    token.save(update_fields=["token_hash"])
    return raw
