"""Login + JWT: claims, rotation, blacklist, account-state guards, lockout."""

from __future__ import annotations

import pytest
from django.urls import reverse
from django.utils import timezone
from freezegun import freeze_time
from rest_framework_simplejwt.tokens import AccessToken

from accounts.services.tokens import tokens_for_user

pytestmark = pytest.mark.django_db


def _login(api, email, password):
    return api.post(
        reverse("api:accounts:login"), {"email": email, "password": password}, format="json"
    )


def test_login_returns_pair_with_claims(api, user, password):
    resp = _login(api, user.email, password)
    assert resp.status_code == 200
    access = AccessToken(resp.json()["access"])
    assert access["user_id"] == str(user.id)
    assert access["is_hirer"] is True
    assert access["account_level"] == user.account_level
    assert access["is_active"] is True
    assert access["tv"] == user.token_version


def test_login_wrong_password_is_invalid_credentials(api, user):
    resp = _login(api, user.email, "Wrong12345")
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "invalid_credentials"


def test_unverified_phone_blocks_login(api, password):
    from accounts.factories import UserFactory

    u = UserFactory(unverified=True)
    resp = _login(api, u.email, password)
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "phone_not_verified"


def test_suspended_user_rejected_at_login(api, user, password):
    user.suspended_at = timezone.now()
    user.save(update_fields=["suspended_at"])
    resp = _login(api, user.email, password)
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "account_suspended"


def test_deleted_user_rejected_at_login(api, user, password):
    user.soft_delete()
    resp = _login(api, user.email, password)
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "account_deleted"


def test_refresh_rotates_and_preserves_claims(api, user):
    refresh = tokens_for_user(user)["refresh"]
    resp = api.post(reverse("api:accounts:token-refresh"), {"refresh": refresh}, format="json")
    assert resp.status_code == 200
    new_access = AccessToken(resp.json()["access"])
    assert new_access["user_id"] == str(user.id)


def test_suspended_user_rejected_at_refresh(api, user):
    refresh = tokens_for_user(user)["refresh"]
    user.suspended_at = timezone.now()
    user.save(update_fields=["suspended_at"])
    resp = api.post(reverse("api:accounts:token-refresh"), {"refresh": refresh}, format="json")
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "account_suspended"


def test_token_version_bump_revokes_refresh(api, user):
    refresh = tokens_for_user(user)["refresh"]
    user.token_version += 1
    user.save(update_fields=["token_version"])
    resp = api.post(reverse("api:accounts:token-refresh"), {"refresh": refresh}, format="json")
    assert resp.status_code in (401, 403)


def test_logout_blacklists_refresh(api, auth, user):
    client = auth(user)
    refresh = tokens_for_user(user)["refresh"]
    resp = client.post(reverse("api:accounts:logout"), {"refresh": refresh}, format="json")
    assert resp.status_code == 205
    # The blacklisted refresh can no longer be used.
    again = api.post(reverse("api:accounts:token-refresh"), {"refresh": refresh}, format="json")
    assert again.status_code in (401, 403)


def test_stale_token_version_rejected_by_authentication(api, user):
    access = tokens_for_user(user)["access"]
    user.token_version += 1
    user.save(update_fields=["token_version"])
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
    resp = api.get(reverse("api:accounts:me"))
    assert resp.status_code == 401


def test_login_lockout_after_five_failures(api, user):
    # The coarse `login` request-throttle is 5/min, so the 5th request still
    # reaches the view; its 5th *failure* trips the IP lockout (a distinct,
    # complementary mechanism that counts failures, not requests).
    with freeze_time("2026-06-16 12:00:00"):
        for _ in range(4):
            assert _login(api, user.email, "Wrong12345").status_code == 401
        fifth = _login(api, user.email, "Wrong12345")
        assert fifth.status_code == 429
        assert fifth.json()["error"]["code"] == "login_locked"
    # After the 15-minute window both the lockout and the throttle have cleared.
    with freeze_time("2026-06-16 12:15:01"):
        ok = _login(api, user.email, "Terminal123")
        assert ok.status_code == 200
