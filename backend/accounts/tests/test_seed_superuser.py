"""seed_superuser: env-driven, idempotent, password-preserving."""

from __future__ import annotations

import pytest
from django.contrib.auth import get_user_model
from django.core.management import call_command

ENV = {
    "SEED_SUPERUSER_EMAIL": "admin@terminal.test",
    "SEED_SUPERUSER_PHONE": "+2348010000000",
    "SEED_SUPERUSER_PASSWORD": "seed-pass-123",
}


@pytest.mark.django_db
def test_creates_superuser(monkeypatch):
    for k, v in ENV.items():
        monkeypatch.setenv(k, v)
    call_command("seed_superuser")

    user = get_user_model().objects.get(email="admin@terminal.test")
    assert user.is_superuser and user.is_staff
    assert user.check_password("seed-pass-123")


@pytest.mark.django_db
def test_is_idempotent_and_preserves_password(monkeypatch):
    for k, v in ENV.items():
        monkeypatch.setenv(k, v)
    call_command("seed_superuser")
    # Second run must not error or create a duplicate, nor reset the password.
    monkeypatch.setenv("SEED_SUPERUSER_PASSWORD", "a-different-password")
    call_command("seed_superuser")

    users = get_user_model().objects.filter(email="admin@terminal.test")
    assert users.count() == 1
    assert users.get().check_password("seed-pass-123")


@pytest.mark.django_db
def test_skips_when_env_incomplete(monkeypatch):
    monkeypatch.delenv("SEED_SUPERUSER_EMAIL", raising=False)
    monkeypatch.delenv("SEED_SUPERUSER_PHONE", raising=False)
    monkeypatch.delenv("SEED_SUPERUSER_PASSWORD", raising=False)
    call_command("seed_superuser")
    assert get_user_model().objects.count() == 0
