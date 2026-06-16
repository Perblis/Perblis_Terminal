"""Shared fixtures for accounts tests."""

from __future__ import annotations

import pytest
from django.core.cache import cache
from rest_framework.test import APIClient

from accounts.factories import DEFAULT_PASSWORD, UserFactory
from accounts.services.tokens import tokens_for_user


@pytest.fixture(autouse=True)
def _clear_cache():
    """Throttles and the login-failure lockout live in the cache; isolate tests."""
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def api() -> APIClient:
    return APIClient()


@pytest.fixture
def password() -> str:
    return DEFAULT_PASSWORD


@pytest.fixture
def user(db):
    return UserFactory()


@pytest.fixture
def verified_user(db):
    return UserFactory(account_level="verified")


@pytest.fixture
def staff_user(db):
    return UserFactory(staff=True)


@pytest.fixture
def auth(api):
    """Authenticate the APIClient as `user` with a real access token."""

    def _auth(user):
        tokens = tokens_for_user(user)
        api.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
        return api

    return _auth
