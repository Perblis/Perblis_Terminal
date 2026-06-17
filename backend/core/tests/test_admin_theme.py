"""The admin renders as the branded, themed "Terminal Ops Console".

Visual-theming smoke tests (no live static server needed — the Django test
client renders templates and `{% static %}` resolves under the default storage):
the index loads, carries the Ops-Console branding + the Heavy Duty stylesheet
link, and the static-serving plumbing (WhiteNoise) is wired so the theme can
actually load in production.
"""

from __future__ import annotations

import pytest
from django.conf import settings
from django.test import Client

from accounts.factories import UserFactory


@pytest.fixture
def ops_client(db) -> Client:
    """A Django test client logged in as an Operator (staff superuser)."""
    staff = UserFactory(staff=True)
    client = Client()
    client.force_login(staff)
    return client


def test_admin_index_is_branded_ops_console(ops_client):
    resp = ops_client.get("/admin/")
    assert resp.status_code == 200
    body = resp.content.decode()
    # Lexicon: the surface is the "Ops Console", not "Django administration".
    # The wordmark renders as `Terminal <strong>Ops Console</strong>`, so the
    # contiguous text is "Ops Console"; the site title carries "Terminal Ops".
    assert "Ops Console" in body
    assert "Terminal Ops" in body
    assert "Django administration" not in body


def test_admin_loads_heavy_duty_stylesheet(ops_client):
    body = ops_client.get("/admin/").content.decode()
    assert "admin/css/heavy-duty.css" in body


def test_site_labels_set():
    from django.contrib import admin

    assert admin.site.site_header == "Terminal Ops Console"
    assert admin.site.site_title == "Terminal Ops"
    assert admin.site.index_title == "Operations"


def test_whitenoise_static_serving_is_wired():
    """Without this, /static/ 404s under gunicorn in prod and nothing themes."""
    assert "whitenoise.middleware.WhiteNoiseMiddleware" in settings.MIDDLEWARE
    sec = settings.MIDDLEWARE.index("django.middleware.security.SecurityMiddleware")
    wn = settings.MIDDLEWARE.index("whitenoise.middleware.WhiteNoiseMiddleware")
    # WhiteNoise must sit immediately after SecurityMiddleware.
    assert wn == sec + 1
