"""Ably realtime — REST publish + signed TokenRequest minting, keyless-degraded.

Hand-rolled httpx (no SDK), matching ``payments/paystack.py`` and
``accounts/integrations/sms.py``. Ably is **fan-out only**; Postgres is the
message of record. With no ``ABLY_API_KEY`` (dev/CI) ``publish`` is a logged
no-op and token minting reports not-configured, so everything works by polling.

Lives in ``core`` (not ``messaging``) so both ``messaging`` (new messages,
unread badges) and ``hires`` (hire-status events) can publish without an
``hires`` → ``messaging`` import cycle.

Channels (TSD §4): ``conv:{id}`` (new messages) · ``user:{id}`` (badge deltas +
hire status). Token capabilities are scoped per caller to their own channels.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
import time
from typing import Any

import httpx
import structlog
from django.conf import settings

logger = structlog.get_logger(__name__)

_TIMEOUT = 5.0
_REST_BASE = "https://rest.ably.io"
_TOKEN_TTL_MS = 3_600_000  # 1 hour


def is_configured() -> bool:
    return bool(settings.ABLY_API_KEY)


def _key_parts() -> tuple[str, str]:
    """Split an Ably key ``appId.keyId:keySecret`` into ``(keyName, keySecret)``."""
    name, _, secret = settings.ABLY_API_KEY.partition(":")
    return name, secret


def publish(channel: str, name: str, data: dict[str, Any]) -> bool:
    """Publish one event to an Ably channel. No-op (logged) when keyless.

    Best-effort: never raises into the caller — realtime is fan-out only and a
    publish failure must not roll back the transaction that scheduled it.
    """
    if not is_configured():
        logger.info("ably.publish_skipped", channel=channel, name=name)
        return False
    key_name, key_secret = _key_parts()
    try:
        resp = httpx.post(
            f"{_REST_BASE}/channels/{channel}/messages",
            auth=(key_name, key_secret),  # Ably REST uses HTTP basic auth
            json={"name": name, "data": data},
            timeout=_TIMEOUT,
        )
        resp.raise_for_status()
    except httpx.HTTPError:
        logger.exception("ably.publish_failed", channel=channel, name=name)
        return False
    return True


def _canonical_capability(capability: dict[str, list[str]]) -> str:
    """Ably canonical form: resources sorted, operations sorted within each."""
    canonical = {res: sorted(ops) for res, ops in sorted(capability.items())}
    return json.dumps(canonical, separators=(",", ":"))


def create_token_request(
    *, client_id: str, capability: dict[str, list[str]]
) -> dict[str, Any] | None:
    """Build a signed Ably TokenRequest for ``client_id`` and ``capability``.

    Returns ``None`` when keyless (the view surfaces ``not_configured``). The
    MAC is HMAC-SHA256 over the newline-joined fields, base64-encoded — the
    scheme Ably's client SDKs expect from an auth server.
    """
    if not is_configured():
        return None
    key_name, key_secret = _key_parts()
    capability_str = _canonical_capability(capability)
    ttl = _TOKEN_TTL_MS
    timestamp = int(time.time() * 1000)
    nonce = secrets.token_hex(16)
    signed = (
        "\n".join([key_name, str(ttl), capability_str, client_id, str(timestamp), nonce]) + "\n"
    )
    mac = base64.b64encode(
        hmac.new(key_secret.encode(), signed.encode(), hashlib.sha256).digest()
    ).decode()
    return {
        "keyName": key_name,
        "ttl": ttl,
        "capability": capability_str,
        "clientId": client_id,
        "timestamp": timestamp,
        "nonce": nonce,
        "mac": mac,
    }
