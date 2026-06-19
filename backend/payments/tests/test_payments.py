"""Bachs collect-flow tests (TSD §3.6, D-017).

Covers checkout init + the attempt cap, webhook signature rejection, envelope
dedup, verify-before-transition (an unverifiable charge never confirms), the
end-to-end confirm, and processor-level replay idempotency.
"""

from __future__ import annotations

import json
import time
from typing import cast

import pytest

from hires import services as hire_services
from hires.enums import HireStatus
from hires.factories import HireFactory
from hires.models import Hire
from listings.enums import ListingStatus
from listings.factories import ListingFactory
from payments import bachs, services
from payments.enums import PaymentState
from payments.errors import PaymentAttemptsExceeded
from payments.models import Payment, PaymentEvent

pytestmark = pytest.mark.django_db

WEBHOOK = "/api/v1/payments/webhook"
SECRET = "whsec_test_secret"


@pytest.fixture
def accepted_hire():
    listing = ListingFactory(status=ListingStatus.LIVE, unit_count=1, daily_price=8_000_000)
    return HireFactory(listing=listing, accepted=True)


def _verified(monkeypatch, *, amount_kobo, status="SUCCEEDED", currency="NGN"):
    monkeypatch.setattr(
        bachs,
        "verify_charge",
        lambda charge_id: bachs.Charge(
            ok=True, status=status, amount_kobo=amount_kobo, currency=currency
        ),
    )


def _post_event(api, *, event_id, reference, charge_id="chg_1", event_type="collection.succeeded"):
    envelope = {
        "id": event_id,
        "type": event_type,
        "data": {"reference": reference, "charge_id": charge_id},
    }
    body = json.dumps(envelope).encode()
    ts = str(int(time.time()))
    return api.post(
        WEBHOOK,
        data=body,
        content_type="application/json",
        HTTP_X_BACHS_TIMESTAMP=ts,
        HTTP_X_BACHS_SIGNATURE=bachs.sign(ts, body, SECRET),
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
    settings.BACHS_WEBHOOK_SECRET = SECRET
    payment = services.initialize_payment(accepted_hire)
    body = json.dumps({"id": "evt_x", "type": "collection.succeeded", "data": {}}).encode()
    resp = api.post(
        WEBHOOK,
        data=body,
        content_type="application/json",
        HTTP_X_BACHS_TIMESTAMP=str(int(time.time())),
        HTTP_X_BACHS_SIGNATURE="deadbeef",
    )
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "invalid_webhook_signature"
    assert not PaymentEvent.objects.exists()
    payment.refresh_from_db()
    assert payment.state == PaymentState.INITIATED


def test_webhook_dedups_on_event_id(api, accepted_hire, settings, monkeypatch):
    settings.BACHS_WEBHOOK_SECRET = SECRET
    payment = services.initialize_payment(accepted_hire)
    _verified(monkeypatch, amount_kobo=payment.amount)

    first = _post_event(api, event_id="evt_1", reference=payment.reference)
    assert first.json()["status"] == "accepted"
    second = _post_event(api, event_id="evt_1", reference=payment.reference)
    assert second.json()["status"] == "duplicate"
    assert PaymentEvent.objects.filter(event_id="evt_1").count() == 1
    assert Payment.objects.filter(state=PaymentState.SUCCESS).count() == 1


# --- verify-before-transition ----------------------------------------------
def test_unverifiable_charge_does_not_confirm(api, accepted_hire, settings):
    # No Bachs key configured → verify_charge returns ok=False → no transition.
    settings.BACHS_WEBHOOK_SECRET = SECRET
    payment = services.initialize_payment(accepted_hire)
    resp = _post_event(api, event_id="evt_2", reference=payment.reference)
    assert resp.status_code == 200
    accepted_hire.refresh_from_db()
    assert accepted_hire.status == HireStatus.ACCEPTED  # still not paid
    payment.refresh_from_db()
    assert payment.state == PaymentState.INITIATED


def test_amount_mismatch_does_not_confirm(api, accepted_hire, settings, monkeypatch):
    settings.BACHS_WEBHOOK_SECRET = SECRET
    payment = services.initialize_payment(accepted_hire)
    _verified(monkeypatch, amount_kobo=payment.amount - 1)  # wrong amount
    _post_event(api, event_id="evt_3", reference=payment.reference)
    accepted_hire.refresh_from_db()
    assert accepted_hire.status == HireStatus.ACCEPTED


# --- end-to-end confirm + replay -------------------------------------------
def test_verified_collection_confirms_hire(api, accepted_hire, settings, monkeypatch):
    settings.BACHS_WEBHOOK_SECRET = SECRET
    payment = services.initialize_payment(accepted_hire)
    _verified(monkeypatch, amount_kobo=payment.amount)

    resp = _post_event(api, event_id="evt_4", reference=payment.reference)
    assert resp.json()["status"] == "accepted"
    accepted_hire.refresh_from_db()
    assert accepted_hire.status == HireStatus.CONFIRMED
    payment.refresh_from_db()
    assert payment.state == PaymentState.SUCCESS
    assert payment.paid_at is not None
    assert PaymentEvent.objects.get(event_id="evt_4").processed_at is not None


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
    services.record_event(
        event_id="evt_5",
        event_type="collection.succeeded",
        payload={"data": {"reference": payment.reference, "charge_id": "chg_5"}},
    )
    services.process_collection_event("evt_5")
    services.process_collection_event("evt_5")  # replay
    accepted_hire.refresh_from_db()
    assert accepted_hire.status == HireStatus.CONFIRMED
    assert Payment.objects.filter(state=PaymentState.SUCCESS).count() == 1
