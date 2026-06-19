"""Test settings: fast hashers, in-memory email, isolated config."""

from __future__ import annotations

from .base import *  # noqa: F401,F403

DEBUG = False
ALLOWED_HOSTS = ["*"]

# Fast password hashing for the test suite.
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]

EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"

# Hermetic integrations: never inherit a developer's real keys from .env, and
# never make a live external call from the suite. Tests that exercise the
# "configured" path set these explicitly via the pytest ``settings`` fixture.
BACHS_SECRET_KEY = ""
BACHS_WEBHOOK_SECRET = ""

# Run enqueued tasks immediately so task round-trips are testable without a
# separate worker process. The compose-backed integration test overrides this.
TASKS = {
    "default": {
        "BACKEND": "django_tasks.backends.immediate.ImmediateBackend",
    },
}
