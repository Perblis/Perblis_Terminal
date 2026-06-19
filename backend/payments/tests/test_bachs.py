"""Bachs adapter unit tests — the money boundary, HTTP calls, and signatures.

The kobo↔naira-string conversion is load-bearing money code (no floats), and
the configured HTTP paths are exercised with a mocked transport so the live-key
branches are covered without a network.
"""

from __future__ import annotations

import time

import httpx
import pytest

from payments import bachs


@pytest.mark.parametrize(
    "kobo,naira",
    [(0, "0.00"), (5, "0.05"), (250_000, "2500.00"), (123_456, "1234.56"), (7_500_000, "75000.00")],
)
def test_kobo_naira_roundtrip(kobo, naira):
    assert bachs.kobo_to_naira_str(kobo) == naira
    assert bachs.naira_str_to_kobo(naira) == kobo


def test_naira_str_to_kobo_tolerates_missing_fraction():
    assert bachs.naira_str_to_kobo("100") == 10_000


def _mock_httpx(monkeypatch, *, capture=None, json_data=None, method="post"):
    def handler(url, **kwargs):
        if capture is not None:
            capture.update({"url": url, **kwargs})
        return httpx.Response(200, json=json_data or {}, request=httpx.Request(method, url))

    monkeypatch.setattr(httpx, method, handler)


def test_create_checkout_configured(monkeypatch, settings):
    settings.BACHS_SECRET_KEY = "sk_sandbox_x"
    settings.BACHS_API_BASE = "https://sandbox-api.bachs.io/v1"
    captured: dict = {}
    _mock_httpx(
        monkeypatch,
        capture=captured,
        json_data={"authorization_url": "https://pay.bachs/abc", "charge_id": "chg_1"},
    )
    out = bachs.create_checkout(reference="THR-1-1", amount_kobo=24_000_000, hire_id="h1")
    assert out == {"authorization_url": "https://pay.bachs/abc", "charge_id": "chg_1"}
    # Money crosses the boundary as a decimal-naira string.
    assert captured["json"]["amount"] == "240000.00"
    assert captured["json"]["currency"] == "NGN"


def test_verify_charge_configured(monkeypatch, settings):
    settings.BACHS_SECRET_KEY = "sk_sandbox_x"
    _mock_httpx(
        monkeypatch,
        json_data={"status": "SUCCEEDED", "amount": "240000.00", "currency": "NGN"},
        method="get",
    )
    charge = bachs.verify_charge("chg_1")
    assert charge.ok and charge.status == "SUCCEEDED"
    assert charge.amount_kobo == 24_000_000 and charge.currency == "NGN"


def test_verify_charge_unconfigured_is_not_ok(settings):
    settings.BACHS_SECRET_KEY = ""
    assert bachs.verify_charge("chg_1").ok is False


def test_verify_charge_http_error_is_not_ok(monkeypatch, settings):
    settings.BACHS_SECRET_KEY = "sk_sandbox_x"

    def boom(url, **kwargs):
        raise httpx.ConnectError("down")

    monkeypatch.setattr(httpx, "get", boom)
    assert bachs.verify_charge("chg_1").ok is False


def test_create_refund_configured(monkeypatch, settings):
    settings.BACHS_SECRET_KEY = "sk_sandbox_x"
    _mock_httpx(monkeypatch, json_data={"id": "rf_1"})
    out = bachs.create_refund(charge_id="chg_1", amount_kobo=1_000_000, reason="cancel")
    assert out == {"ok": True, "provider_ref": "rf_1"}


def test_create_refund_unconfigured(settings):
    settings.BACHS_SECRET_KEY = ""
    assert bachs.create_refund(charge_id="chg_1", amount_kobo=1, reason="x")["ok"] is False


# --- signature verification -------------------------------------------------
def test_signature_roundtrip(settings):
    settings.BACHS_WEBHOOK_SECRET = "whsec_x"
    body = b'{"id":"evt_1"}'
    ts = str(int(time.time()))
    sig = bachs.sign(ts, body, "whsec_x")
    assert bachs.verify_signature(timestamp=ts, raw_body=body, signature=sig) is True


def test_signature_rejects_tampered_body(settings):
    settings.BACHS_WEBHOOK_SECRET = "whsec_x"
    ts = str(int(time.time()))
    sig = bachs.sign(ts, b"original", "whsec_x")
    assert bachs.verify_signature(timestamp=ts, raw_body=b"tampered", signature=sig) is False


def test_signature_rejects_stale_timestamp(settings):
    settings.BACHS_WEBHOOK_SECRET = "whsec_x"
    body = b"{}"
    old = str(int(time.time()) - 10_000)
    assert (
        bachs.verify_signature(
            timestamp=old, raw_body=body, signature=bachs.sign(old, body, "whsec_x")
        )
        is False
    )


def test_signature_rejects_when_unconfigured_or_missing(settings):
    settings.BACHS_WEBHOOK_SECRET = ""
    assert bachs.verify_signature(timestamp="1", raw_body=b"{}", signature="x") is False
    settings.BACHS_WEBHOOK_SECRET = "whsec_x"
    assert bachs.verify_signature(timestamp=None, raw_body=b"{}", signature="x") is False
    assert bachs.verify_signature(timestamp="notanint", raw_body=b"{}", signature="x") is False
