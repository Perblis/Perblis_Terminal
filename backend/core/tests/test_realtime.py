"""Ably adapter unit tests (TSD §4) — no network; httpx is monkeypatched."""

from __future__ import annotations

import base64
import hashlib
import hmac

import httpx

from core import realtime

KEY = "app123.keyABC:secretvalue"


def test_token_request_is_none_when_keyless(settings):
    settings.ABLY_API_KEY = ""
    assert (
        realtime.create_token_request(client_id="u1", capability={"user:u1": ["subscribe"]}) is None
    )


def test_token_request_is_signed_and_canonical(settings):
    settings.ABLY_API_KEY = KEY
    cap = {"user:u1": ["subscribe"], "conv:b": ["subscribe"], "conv:a": ["subscribe", "presence"]}
    tr = realtime.create_token_request(client_id="u1", capability=cap)
    assert tr is not None
    assert tr["keyName"] == "app123.keyABC"
    assert tr["clientId"] == "u1"
    # capability is canonical: resources sorted, ops sorted within each
    assert tr["capability"] == (
        '{"conv:a":["presence","subscribe"],"conv:b":["subscribe"],"user:u1":["subscribe"]}'
    )
    # mac verifies against the documented newline-joined signing string
    signed = (
        "\n".join(
            [
                tr["keyName"],
                str(tr["ttl"]),
                tr["capability"],
                tr["clientId"],
                str(tr["timestamp"]),
                tr["nonce"],
            ]
        )
        + "\n"
    )
    expected = base64.b64encode(
        hmac.new(b"secretvalue", signed.encode(), hashlib.sha256).digest()
    ).decode()
    assert tr["mac"] == expected


def test_publish_noop_when_keyless(settings):
    settings.ABLY_API_KEY = ""
    assert realtime.publish("conv:x", "message", {"a": 1}) is False


def test_publish_posts_with_basic_auth_when_configured(settings, monkeypatch):
    settings.ABLY_API_KEY = KEY
    captured = {}

    def fake_post(url, auth=None, timeout=None, **kwargs):
        captured["url"] = url
        captured["auth"] = auth
        captured["json"] = kwargs.get("json")

        class _Resp:
            def raise_for_status(self):
                return None

        return _Resp()

    monkeypatch.setattr(httpx, "post", fake_post)
    ok = realtime.publish("conv:abc", "message", {"hello": "world"})
    assert ok is True
    assert captured["url"].endswith("/channels/conv:abc/messages")
    assert captured["auth"] == ("app123.keyABC", "secretvalue")
    assert captured["json"]["name"] == "message"


def test_publish_returns_false_on_http_error(settings, monkeypatch):
    settings.ABLY_API_KEY = KEY

    def boom(*a, **k):
        raise httpx.HTTPError("down")

    monkeypatch.setattr(httpx, "post", boom)
    assert realtime.publish("conv:x", "message", {}) is False
