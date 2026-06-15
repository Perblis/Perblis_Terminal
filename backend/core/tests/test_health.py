"""Health probes: green with DB up, degraded when a check fails."""

from __future__ import annotations

import pytest
from django.test import override_settings

from core import health


@pytest.mark.django_db
def test_healthz_green_with_db_up(client):
    response = client.get("/healthz")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["checks"]["database"] == "ok"


def test_healthz_degraded_when_db_down(client, monkeypatch):
    monkeypatch.setattr(health, "_check_db", lambda: (False, "error"))
    response = client.get("/healthz")
    assert response.status_code == 503
    assert response.json()["status"] == "degraded"


# Settings are overridden explicitly so the assertions don't depend on whatever
# integration keys happen to be present in the ambient environment.


@pytest.mark.django_db
@override_settings(R2_ACCESS_KEY_ID="", R2_SECRET="", ABLY_API_KEY="", PAYSTACK_SECRET_KEY="")
def test_readyz_reports_not_configured_without_keys(client):
    response = client.get("/readyz")
    assert response.status_code == 200
    checks = response.json()["checks"]
    # Missing keys degrade to not_configured and never crash the probe.
    assert checks["database"] == "ok"
    assert checks["r2"] == "not_configured"
    assert checks["ably"] == "not_configured"
    assert checks["paystack"] == "not_configured"


@pytest.mark.django_db
@override_settings(
    R2_ACCESS_KEY_ID="ak", R2_SECRET="sk", ABLY_API_KEY="key", PAYSTACK_SECRET_KEY="sk_test"
)
def test_readyz_reports_configured_when_keys_present(client):
    response = client.get("/readyz")
    assert response.status_code == 200
    checks = response.json()["checks"]
    assert checks["r2"] == "configured"
    assert checks["ably"] == "configured"
    assert checks["paystack"] == "configured"
