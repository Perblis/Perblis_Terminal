"""Project-wide pytest fixtures.

Shared across the domain apps (suppliers, listings, …). The accounts app keeps
its own ``tests/conftest.py`` for auth-specific fixtures; these are the common
client/auth helpers every app needs.
"""

from __future__ import annotations

import pytest
from django.core.cache import cache
from rest_framework.test import APIClient

from accounts.factories import UserFactory
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
def auth(api):
    """Authenticate the APIClient as a user with a real access token."""

    def _auth(user):
        tokens = tokens_for_user(user)
        api.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
        return api

    return _auth


@pytest.fixture
def supplier(db):
    """A verified supplier with no profile yet."""
    return UserFactory(is_supplier=True, account_level="verified")


@pytest.fixture
def supplier2(db):
    """A second verified supplier — for ownership-isolation tests."""
    return UserFactory(is_supplier=True, account_level="verified")


@pytest.fixture
def hirer(db):
    """A plain hirer (not a supplier)."""
    return UserFactory()
