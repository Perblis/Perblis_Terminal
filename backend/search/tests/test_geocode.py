"""Geocoding proxy — FSD §6 §3.4 / TSD §3.8 (Wave 3 §3.4).

Key never reaches the client · 24h cache (cache hit on repeat) · graceful
degradation when unconfigured or upstream fails.
"""

from __future__ import annotations

import httpx
import pytest

pytestmark = pytest.mark.django_db

GEOCODE = "/api/v1/geocode"

_LOCATIONIQ_SAMPLE = [
    {"display_name": "Apapa, Lagos, Nigeria", "lat": "6.4433", "lon": "3.3792"},
    {"display_name": "Apapa Wharf, Lagos", "lat": "6.4400", "lon": "3.3700"},
]


class _FakeResponse:
    def __init__(self, payload):
        self._payload = payload

    def raise_for_status(self):
        return None

    def json(self):
        return self._payload


class _Stub:
    def __init__(self) -> None:
        self.n = 0
        self.last_params: dict | None = None


@pytest.fixture
def stub_locationiq(settings, monkeypatch):
    """Configure a key and stub the upstream; returns a call recorder."""
    settings.LOCATIONIQ_KEY = "test-secret-key-do-not-leak"
    stub = _Stub()

    def fake_get(url, params=None, timeout=None):
        stub.n += 1
        stub.last_params = params
        return _FakeResponse(_LOCATIONIQ_SAMPLE)

    monkeypatch.setattr(httpx, "get", fake_get)
    return stub


def test_geocode_not_configured_degrades_gracefully(api, settings):
    settings.LOCATIONIQ_KEY = ""
    resp = api.get(GEOCODE, {"q": "Apapa"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["provider_configured"] is False
    assert body["results"] == []


def test_geocode_returns_mapped_results(api, stub_locationiq):
    body = api.get(GEOCODE, {"q": "Apapa"}).json()
    assert body["provider_configured"] is True
    assert body["results"][0] == {
        "display_name": "Apapa, Lagos, Nigeria",
        "lat": 6.4433,
        "lng": 3.3792,
    }
    assert len(body["results"]) == 2


def test_geocode_never_leaks_the_key(api, stub_locationiq):
    resp = api.get(GEOCODE, {"q": "Apapa"})
    assert "test-secret-key-do-not-leak" not in resp.content.decode()


def test_geocode_caches_repeat_query(api, stub_locationiq):
    api.get(GEOCODE, {"q": "Apapa"})
    api.get(GEOCODE, {"q": "Apapa"})  # identical → served from cache
    assert stub_locationiq.n == 1  # upstream hit only once


def test_geocode_cache_key_includes_limit(api, stub_locationiq):
    api.get(GEOCODE, {"q": "Apapa", "limit": 5})
    api.get(GEOCODE, {"q": "Apapa", "limit": 3})  # different limit → fresh call
    assert stub_locationiq.n == 2


def test_geocode_query_normalised_for_cache(api, stub_locationiq):
    api.get(GEOCODE, {"q": "Apapa"})
    api.get(GEOCODE, {"q": "  apapa  "})  # case/whitespace-insensitive cache key
    assert stub_locationiq.n == 1


def test_geocode_transient_failure_not_cached(api, settings, monkeypatch):
    settings.LOCATIONIQ_KEY = "test-key"
    calls = {"n": 0}

    def boom(url, params=None, timeout=None):
        calls["n"] += 1
        raise httpx.ConnectError("upstream down")

    monkeypatch.setattr(httpx, "get", boom)

    first = api.get(GEOCODE, {"q": "Apapa"}).json()
    assert first["results"] == []
    assert first["provider_configured"] is True  # key set, just unreachable
    api.get(GEOCODE, {"q": "Apapa"})  # retried, not served from a cached failure
    assert calls["n"] == 2


def test_geocode_limit_forwarded_to_upstream(api, stub_locationiq):
    api.get(GEOCODE, {"q": "Apapa", "limit": 3})
    assert stub_locationiq.last_params["limit"] == 3


def test_geocode_limit_above_max_rejected(api):
    resp = api.get(GEOCODE, {"q": "Apapa", "limit": 9999})
    assert resp.status_code == 400


def test_geocode_requires_q(api):
    resp = api.get(GEOCODE)
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "validation_error"


def test_geocode_q_min_length(api):
    resp = api.get(GEOCODE, {"q": "a"})
    assert resp.status_code == 400


def test_geocode_anonymous_allowed(api, stub_locationiq):
    assert api.get(GEOCODE, {"q": "Apapa"}).status_code == 200
