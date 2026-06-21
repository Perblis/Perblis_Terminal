"""Paystack adapter unit tests — kobo-native money, HTTP paths, SHA512 signatures.

Paystack speaks integer kobo directly (no decimal conversion); the configured
HTTP paths run against a mocked transport so live-key branches are covered
without a network.
"""

from __future__ import annotations

import httpx

from payments import gateway, paystack
from payments.contracts import WebhookEvent

SECRET = "sk_test_dummy"


def _mock_httpx(monkeypatch, *, capture=None, json_data=None, method="post"):
    def handler(url, **kwargs):
        if capture is not None:
            capture.update({"url": url, **kwargs})
        return httpx.Response(200, json=json_data or {}, request=httpx.Request(method, url))

    monkeypatch.setattr(httpx, method, handler)


def test_create_checkout_sends_integer_kobo(monkeypatch, settings):
    settings.PAYSTACK_SECRET_KEY = SECRET
    captured: dict = {}
    _mock_httpx(
        monkeypatch,
        capture=captured,
        json_data={"data": {"authorization_url": "https://paystack/pay/abc", "id": 99}},
    )
    out = paystack.create_checkout(
        reference="THR-1-1", amount_kobo=24_000_000, customer_email="h@example.com", hire_id="h1"
    )
    assert out == {"authorization_url": "https://paystack/pay/abc", "charge_id": "99"}
    # Paystack amounts are integer kobo — no decimal-naira conversion.
    assert captured["json"]["amount"] == 24_000_000
    assert captured["json"]["email"] == "h@example.com"
    assert captured["json"]["currency"] == "NGN"


def test_create_checkout_stub_when_unconfigured(settings):
    settings.PAYSTACK_SECRET_KEY = ""
    out = paystack.create_checkout(
        reference="THR-1-1", amount_kobo=1, customer_email="h@example.com", hire_id="h1"
    )
    assert out["authorization_url"] and out["charge_id"] == ""


def test_verify_charge_success(monkeypatch, settings):
    settings.PAYSTACK_SECRET_KEY = SECRET
    _mock_httpx(
        monkeypatch,
        json_data={"data": {"status": "success", "amount": 24_000_000, "currency": "NGN"}},
        method="get",
    )
    charge = paystack.verify_charge(reference="THR-1-1")
    assert charge.ok and charge.succeeded
    assert charge.amount_kobo == 24_000_000 and charge.currency == "NGN"


def test_verify_charge_unconfigured_is_not_ok(settings):
    settings.PAYSTACK_SECRET_KEY = ""
    assert paystack.verify_charge(reference="THR-1-1").ok is False


def test_verify_charge_http_error_is_not_ok(monkeypatch, settings):
    settings.PAYSTACK_SECRET_KEY = SECRET

    def boom(url, **kwargs):
        raise httpx.ConnectError("down")

    monkeypatch.setattr(httpx, "get", boom)
    assert paystack.verify_charge(reference="THR-1-1").ok is False


def test_create_refund_configured(monkeypatch, settings):
    settings.PAYSTACK_SECRET_KEY = SECRET
    captured: dict = {}
    _mock_httpx(monkeypatch, capture=captured, json_data={"data": {"id": 7}})
    out = paystack.create_refund(
        reference="THR-1-1", charge_id="", amount_kobo=1_000_000, reason="cancel"
    )
    assert out == {"ok": True, "provider_ref": "7"}
    assert captured["json"]["transaction"] == "THR-1-1"
    assert captured["json"]["amount"] == 1_000_000


def test_list_ledger_normalizes(monkeypatch, settings):
    settings.PAYSTACK_SECRET_KEY = SECRET
    _mock_httpx(
        monkeypatch,
        json_data={"data": [{"reference": "THR-1", "amount": 100, "status": "success"}]},
        method="get",
    )
    assert paystack.list_ledger() == [{"reference": "THR-1", "amount_kobo": 100, "succeeded": True}]


# --- signature (HMAC-SHA512 of the raw body with the secret key) ------------
def test_signature_roundtrip(settings):
    settings.PAYSTACK_SECRET_KEY = SECRET
    body = b'{"event":"charge.success"}'
    sig = paystack.sign(body, SECRET)
    assert paystack.verify_signature(headers={"x-paystack-signature": sig}, raw_body=body) is True


def test_signature_rejects_tampered_body(settings):
    settings.PAYSTACK_SECRET_KEY = SECRET
    sig = paystack.sign(b"original", SECRET)
    assert (
        paystack.verify_signature(headers={"x-paystack-signature": sig}, raw_body=b"tampered")
        is False
    )


def test_signature_rejects_when_unconfigured_or_missing(settings):
    settings.PAYSTACK_SECRET_KEY = ""
    assert paystack.verify_signature(headers={"x-paystack-signature": "x"}, raw_body=b"{}") is False
    settings.PAYSTACK_SECRET_KEY = SECRET
    assert paystack.verify_signature(headers={}, raw_body=b"{}") is False


# --- webhook parsing --------------------------------------------------------
def test_parse_webhook_success_event():
    event = paystack.parse_webhook(
        {"event": "charge.success", "data": {"reference": "THR-1", "id": 5}}
    )
    assert isinstance(event, WebhookEvent)
    assert event.succeeded and event.reference == "THR-1"
    assert event.dedup_id == "paystack:charge.success:THR-1"


def test_parse_webhook_non_success_event():
    event = paystack.parse_webhook({"event": "charge.failed", "data": {"reference": "THR-1"}})
    assert event.succeeded is False


# --- gateway provider selection ---------------------------------------------
def test_gateway_selects_provider(settings):
    settings.PAYMENT_PROVIDER = "paystack"
    assert gateway.is_bachs() is False
    settings.PAYMENT_PROVIDER = "bachs"
    assert gateway.is_bachs() is True
