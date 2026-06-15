"""Liveness and readiness probes.

`/healthz` — is the app up and can it reach its database? Used by Railway's
health check; returns 200 only when the DB round-trips.

`/readyz` — the above plus a snapshot of each external integration (R2, Ably,
Paystack). Per commandment 10, a missing key degrades a check to
"not_configured" — it never raises and never fails the probe in dev. Only a
DB failure makes readyz unhealthy.
"""

from __future__ import annotations

from django.conf import settings
from django.db import connection
from django.http import JsonResponse


def _check_db() -> tuple[bool, str]:
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
        return True, "ok"
    except Exception:  # noqa: BLE001 - probe must never raise
        return False, "error"


def _integration_status(*key_settings: str) -> str:
    """'configured' if every required key is present, else 'not_configured'."""
    return "configured" if all(getattr(settings, k, "") for k in key_settings) else "not_configured"


def healthz(request) -> JsonResponse:
    db_ok, db_status = _check_db()
    healthy = db_ok
    payload = {
        "status": "ok" if healthy else "degraded",
        "checks": {"app": "ok", "database": db_status},
    }
    return JsonResponse(payload, status=200 if healthy else 503)


def readyz(request) -> JsonResponse:
    db_ok, db_status = _check_db()
    payload = {
        "status": "ok" if db_ok else "degraded",
        "checks": {
            "database": db_status,
            "r2": _integration_status("R2_ACCESS_KEY_ID", "R2_SECRET"),
            "ably": _integration_status("ABLY_API_KEY"),
            "paystack": _integration_status("PAYSTACK_SECRET_KEY"),
        },
    }
    # Only the database gates readiness; unconfigured integrations are expected
    # in dev and must not fail the probe.
    return JsonResponse(payload, status=200 if db_ok else 503)
