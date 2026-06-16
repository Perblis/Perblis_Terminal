"""GET/PATCH me and activate-supplier."""

from __future__ import annotations

import pytest
from django.urls import reverse

pytestmark = pytest.mark.django_db


def test_get_me_requires_auth(api):
    assert api.get(reverse("api:accounts:me")).status_code == 401


def test_get_me_returns_profile(auth, user):
    resp = auth(user).get(reverse("api:accounts:me"))
    assert resp.status_code == 200
    body = resp.json()
    assert body["email"] == user.email
    assert body["is_hirer"] is True


def test_patch_me_updates_name(auth, user):
    resp = auth(user).patch(reverse("api:accounts:me"), {"full_name": "New Name"}, format="json")
    assert resp.status_code == 200
    user.refresh_from_db()
    assert user.full_name == "New Name"


def test_patch_me_cannot_change_account_level(auth, user):
    resp = auth(user).patch(
        reverse("api:accounts:me"), {"account_level": "business_verified"}, format="json"
    )
    assert resp.status_code == 200
    user.refresh_from_db()
    assert user.account_level == "basic"  # read-only field ignored


def test_activate_supplier(auth, user):
    assert user.is_supplier is False
    resp = auth(user).post(reverse("api:accounts:activate-supplier"))
    assert resp.status_code == 200
    user.refresh_from_db()
    assert user.is_supplier is True
