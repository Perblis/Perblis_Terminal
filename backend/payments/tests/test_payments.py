"""Paystack collect-flow tests (TSD §3.6, D-018).

Covers checkout init + the attempt cap, webhook signature rejection, envelope
dedup, verify-before-transition (an unverifiable charge never confirms), the
end-to-end confirm, and processor-level replay idempotency. Runs against the
default provider (Paystack); ``verify_charge`` is monkeypatched so no network is
touched.
"""

from __future__ import annotations

import json
from typing import cast

import pytest

from hires import services as hire_services
from hires.enums import HireStatus
from hires.factories import HireFactory
from hires.models import Hire
from listings.enums import ListingStatus
from listings.factories import ListingFactory
from payments import gateway, paystack, services
from payments.contracts import Charge
from payments.enums import PaymentState
from payments.errors import PaymentAttemptsExceeded
from payments.models import Payment, PaymentEvent

pytestmark = pytest.mark.django_db

WEBHOOK = "/api/v1/payments/webhook"
SECRET = "sk_test_dummy"


@pytest.fixture
def accepted_hire():
    listing = ListingFactory(status=ListingStatus.LIVE, unit_count=1, daily_price=8_000_000)
    return HireFactory(listing=listing, accepted=True)


def _verified(monkeypatch, *, amount_kobo, succeeded=True, currency="NGN"):
    monkeypatch.setattr(
        gateway,
        "verify_charge",
        lambda *, reference, charge_id: Charge(
            ok=True, succeeded=succeeded, amount_kobo=amount_kobo, currency=currency
        ),
    )


def _post_event(api, *, reference, event="charge.success"):
    envelope = {"event": event, "data": {"reference": reference, "id": 4242}}
    body = json.dumps(envelope).encode()
    return api.post(
        WEBHOOK,
        data=body,
        content_type="application/json",
        HTTP_X_PAYSTACK_SIGNATURE=paystack.sign(body, SECRET),
    )


# --- checkout init ----------------------------------------------------------
def test_accept_initializes_checkout(django_capture_on_commit_callbacks):
    listing = ListingFactory(status=ListingStatus.LIVE, unit_count=1, daily_price=8_000_000)
    hire = cast(Hire, HireFactory(listing=listing))  # requested
    with django_capture_on_commit_callbacks(execute=True):
        hire_services.accept_hire(user=listing.supplier, hire_id=hire.id)
    assert Payment.objects.filter(hire=hire, attempt=1).exists()


def test_initialize_payment_creates_checkout(accepted_hire):
    payment = services.initialize_payment(accepted_hire)
    assert payment.state == PaymentState.INITIATED
    assert payment.amount == accepted_hire.hire_value
    assert payment.attempt == 1
    assert payment.authorization_url  # stub URL in keyless dev


def test_payment_attempts_capped_at_three(accepted_hire):
    for _ in range(3):
        services.initialize_payment(accepted_hire)
    with pytest.raises(PaymentAttemptsExceeded):
        services.initialize_payment(accepted_hire)


# --- webhook signature + dedup ---------------------------------------------
def test_webhook_rejects_bad_signature(api, accepted_hire, settings):
    payment = services.initialize_payment(accepted_hire)
    settings.PAYSTACK_SECRET_KEY = SECRET
    body = json.dumps(
        {"event": "charge.success", "data": {"reference": payment.reference}}
    ).encode()
    resp = api.post(
        WEBHOOK, data=body, content_type="application/json", HTTP_X_PAYSTACK_SIGNATURE="deadbeef"
    )
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "invalid_webhook_signature"
    assert not PaymentEvent.objects.exists()
    payment.refresh_from_db()
    assert payment.state == PaymentState.INITIATED


def test_webhook_dedups_on_event(api, accepted_hire, settings, monkeypatch):
    payment = services.initialize_payment(accepted_hire)
    settings.PAYSTACK_SECRET_KEY = SECRET
    _verified(monkeypatch, amount_kobo=payment.amount)

    first = _post_event(api, reference=payment.reference)
    assert first.json()["status"] == "accepted"
    second = _post_event(api, reference=payment.reference)
    assert second.json()["status"] == "duplicate"
    assert PaymentEvent.objects.count() == 1
    assert Payment.objects.filter(state=PaymentState.SUCCESS).count() == 1


# --- verify-before-transition ----------------------------------------------
def test_unverifiable_charge_does_not_confirm(api, accepted_hire, settings, monkeypatch):
    payment = services.initialize_payment(accepted_hire)
    settings.PAYSTACK_SECRET_KEY = SECRET
    monkeypatch.setattr(gateway, "verify_charge", lambda *, reference, charge_id: Charge(ok=False))
    resp = _post_event(api, reference=payment.reference)
    assert resp.status_code == 200
    accepted_hire.refresh_from_db()
    assert accepted_hire.status == HireStatus.ACCEPTED  # still not paid
    payment.refresh_from_db()
    assert payment.state == PaymentState.INITIATED


def test_amount_mismatch_does_not_confirm(api, accepted_hire, settings, monkeypatch):
    payment = services.initialize_payment(accepted_hire)
    settings.PAYSTACK_SECRET_KEY = SECRET
    _verified(monkeypatch, amount_kobo=payment.amount - 1)  # wrong amount
    _post_event(api, reference=payment.reference)
    accepted_hire.refresh_from_db()
    assert accepted_hire.status == HireStatus.ACCEPTED


# --- end-to-end confirm + replay -------------------------------------------
def test_verified_charge_confirms_hire(api, accepted_hire, settings, monkeypatch):
    payment = services.initialize_payment(accepted_hire)
    settings.PAYSTACK_SECRET_KEY = SECRET
    _verified(monkeypatch, amount_kobo=payment.amount)

    resp = _post_event(api, reference=payment.reference)
    assert resp.json()["status"] == "accepted"
    accepted_hire.refresh_from_db()
    assert accepted_hire.status == HireStatus.CONFIRMED
    payment.refresh_from_db()
    assert payment.state == PaymentState.SUCCESS
    assert payment.paid_at is not None


def test_get_payment_status(auth, accepted_hire):
    payment = services.initialize_payment(accepted_hire)
    resp = auth(accepted_hire.hirer).get(f"/api/v1/hires/{accepted_hire.id}/payment")
    assert resp.status_code == 200
    body = resp.json()
    assert body["reference"] == payment.reference
    assert body["state"] == "initiated"
    assert body["authorization_url"]


def test_processor_is_idempotent_on_replay(accepted_hire, monkeypatch):
    payment = services.initialize_payment(accepted_hire)
    _verified(monkeypatch, amount_kobo=payment.amount)
    payload = {"event": "charge.success", "data": {"reference": payment.reference, "id": 4242}}
    dedup_id = paystack.parse_webhook(payload).dedup_id
    services.record_event(event_id=dedup_id, event_type="charge.success", payload=payload)
    services.process_collection_event(dedup_id)
    services.process_collection_event(dedup_id)  # replay
    accepted_hire.refresh_from_db()
    assert accepted_hire.status == HireStatus.CONFIRMED
    assert Payment.objects.filter(state=PaymentState.SUCCESS).count() == 1
