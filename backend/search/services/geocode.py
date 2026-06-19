"""Geocoding proxy (FSD §6 §3.4, TSD §3.8).

Forward-geocodes a free-text query via LocationIQ **server-side** so the API
key never reaches a client. Results are cached 24h through Django's cache
framework — LocMem in dev, the DB cache backend in prod (no Redis, D-010) — so
repeat lookups (and the most common place names) don't burn the LocationIQ
quota. When ``LOCATIONIQ_KEY`` is absent (dev/CI) or the upstream call fails,
the proxy degrades gracefully to an empty result set rather than erroring;
transient failures are not cached.
"""

from __future__ import annotations

import hashlib

import httpx
import structlog
from django.conf import settings
from django.core.cache import cache

logger = structlog.get_logger(__name__)

_SEARCH_URL = "https://us1.locationiq.com/v1/search"
_CACHE_TTL = 60 * 60 * 24  # 24h
DEFAULT_LIMIT = 5
MAX_LIMIT = 10


def _cache_key(query: str, limit: int) -> str:
    digest = hashlib.sha256(f"{query}|{limit}".encode()).hexdigest()
    return f"geocode:{digest}"


def _fetch(query: str, limit: int) -> tuple[list[dict] | None, bool]:
    """Call LocationIQ. Returns ``(results, ok)``; ``ok`` is False when the
    provider is unconfigured or the request fails (so callers don't cache it)."""
    if not settings.LOCATIONIQ_KEY:
        return None, False
    try:
        resp = httpx.get(
            _SEARCH_URL,
            params={
                "key": settings.LOCATIONIQ_KEY,
                "q": query,
                "format": "json",
                "limit": limit,
                "countrycodes": "ng",  # Nigeria-only marketplace
            },
            timeout=10.0,
        )
        resp.raise_for_status()
        data = resp.json()
    except Exception:  # noqa: BLE001 — proxy degrades gracefully, never 500s
        logger.warning("geocode.failed", query=query)
        return None, False
    results = [
        {
            "display_name": item.get("display_name", ""),
            "lat": float(item["lat"]),
            "lng": float(item["lon"]),
        }
        for item in data
        if "lat" in item and "lon" in item
    ]
    return results, True


def geocode(query: str, limit: int = DEFAULT_LIMIT) -> dict:
    """Forward-geocode ``query`` (24h-cached). Always returns the response dict."""
    normalized = query.strip()
    limit = max(1, min(limit, MAX_LIMIT))
    configured = bool(settings.LOCATIONIQ_KEY)
    if not normalized:
        return {"query": query, "provider_configured": configured, "results": []}

    key = _cache_key(normalized.lower(), limit)
    cached = cache.get(key)
    if cached is not None:
        return {"query": normalized, "provider_configured": True, "results": cached}

    results, ok = _fetch(normalized, limit)
    if not ok:
        return {"query": normalized, "provider_configured": configured, "results": []}
    cache.set(key, results, _CACHE_TTL)
    return {"query": normalized, "provider_configured": True, "results": results}
