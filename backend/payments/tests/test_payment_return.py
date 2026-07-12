"""Payment return page + app-aware callback wiring (UX only, webhook stays truth)."""

from __future__ import annotations

import uuid

import pytest
from django.test import Client

from payments import paystack

SECRET = "sk_test_secret"
RETURN = "/api/v1/payments/return"


@pytest.fixture
def client():
    return Client()


# --- the return page -----------------------------------------------------------
@pytest.mark.django_db
def test_return_page_deep_links_the_hire(client, django_assert_num_queries):
    hire_id = str(uuid.uuid4())
    with django_assert_num_queries(0):  # zero oracle: no hire/payment reads
        resp = client.get(RETURN, {"hire_id": hire_id})
    assert resp.status_code == 200
    html = resp.content.decode()
    assert f"terminal://pay/{hire_id}" in html
    assert "Open the Terminal app" in html


def test_return_page_renders_generically_for_garbage(client):
    resp = client.get(RETURN, {"hire_id": "not-a-uuid'><script>"})
    assert resp.status_code == 200
    html = resp.content.decode()
    assert "not-a-uuid" not in html  # invalid input never echoes back
    assert 'href="terminal://"' in html


def test_return_page_without_hire_id(client):
    assert client.get(RETURN).status_code == 200


def test_return_scheme_is_configurable(client, settings):
    settings.APP_RETURN_SCHEME = "terminal-dev"
    hire_id = str(uuid.uuid4())
    html = client.get(RETURN, {"hire_id": hire_id}).content.decode()
    assert f"terminal-dev://pay/{hire_id}" in html


# --- checkout callback composition ----------------------------------------------
def _mock_httpx(monkeypatch, capture):
    class _Resp:
        def raise_for_status(self):
            return None

        def json(self):
            return {"data": {"authorization_url": "u", "id": 1}}

    def _post(url, **kw):
        capture.update(kw)
        return _Resp()

    monkeypatch.setattr(paystack.httpx, "post", _post)


def test_checkout_prefers_app_return_page(monkeypatch, settings):
    settings.PAYSTACK_SECRET_KEY = SECRET
    settings.PAYSTACK_CALLBACK_URL = "https://portal.example/"
    settings.PAYMENT_RETURN_BASE_URL = "https://api.example.com/"
    captured: dict = {}
    _mock_httpx(monkeypatch, captured)
    paystack.create_checkout(
        reference="THR-1-1", amount_kobo=1, customer_email="h@example.com", hire_id="h1"
    )
    assert (
        captured["json"]["callback_url"]
        == "https://api.example.com/api/v1/payments/return?hire_id=h1"
    )


def test_checkout_falls_back_to_static_callback(monkeypatch, settings):
    settings.PAYSTACK_SECRET_KEY = SECRET
    settings.PAYSTACK_CALLBACK_URL = "https://portal.example/"
    settings.PAYMENT_RETURN_BASE_URL = ""
    captured: dict = {}
    _mock_httpx(monkeypatch, captured)
    paystack.create_checkout(
        reference="THR-1-1", amount_kobo=1, customer_email="h@example.com", hire_id="h1"
    )
    assert captured["json"]["callback_url"] == "https://portal.example/"
