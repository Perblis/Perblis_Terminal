"""Payment gateway — the single provider-neutral facade (D-018).

Selects the active provider from ``settings.PAYMENT_PROVIDER`` (``paystack`` |
``bachs``) and exposes one uniform interface to the services and webhook view,
so neither branches on the provider. Paystack already speaks the neutral
contract (``payments.contracts``); Bachs is translated here (it predates the
abstraction and keeps its own signatures).
"""

from __future__ import annotations

from collections.abc import Mapping

from django.conf import settings

from . import bachs, paystack
from .contracts import CURRENCY, Charge, WebhookEvent

__all__ = ["CURRENCY", "Charge", "WebhookEvent"]

_BACHS_SUCCESS = "collection.succeeded"


def _provider() -> str:
    return getattr(settings, "PAYMENT_PROVIDER", "paystack")


def is_bachs() -> bool:
    return _provider() == "bachs"


def configured() -> bool:
    return bachs.configured() if is_bachs() else paystack.configured()


def create_checkout(*, reference: str, amount_kobo: int, customer_email: str, hire_id: str) -> dict:
    if is_bachs():
        return bachs.create_checkout(
            reference=reference,
            amount_kobo=amount_kobo,
            hire_id=hire_id,
            customer_email=customer_email,
        )
    return paystack.create_checkout(
        reference=reference, amount_kobo=amount_kobo, customer_email=customer_email, hire_id=hire_id
    )


def verify_charge(*, reference: str, charge_id: str) -> Charge:
    if is_bachs():
        c = bachs.verify_charge(charge_id)
        return Charge(
            ok=c.ok,
            succeeded=bachs.charge_succeeded(c.status),
            amount_kobo=c.amount_kobo,
            currency=c.currency,
        )
    return paystack.verify_charge(reference=reference, charge_id=charge_id)


def create_refund(*, reference: str, charge_id: str, amount_kobo: int, reason: str) -> dict:
    if is_bachs():
        return bachs.create_refund(
            charge_id=charge_id, amount_kobo=amount_kobo, reason=reason, reference=reference
        )
    return paystack.create_refund(
        reference=reference, charge_id=charge_id, amount_kobo=amount_kobo, reason=reason
    )


def verify_signature(*, headers: Mapping, raw_body: bytes) -> bool:
    if is_bachs():
        return bachs.verify_signature(
            timestamp=headers.get("X-Bachs-Timestamp"),
            raw_body=raw_body,
            signature=headers.get("X-Bachs-Signature"),
        )
    return paystack.verify_signature(headers=headers, raw_body=raw_body)


def parse_webhook(payload: dict) -> WebhookEvent:
    if is_bachs():
        data = payload.get("data", {}) or {}
        event_type = payload.get("type", "")
        return WebhookEvent(
            dedup_id=payload.get("id", ""),
            event_type=event_type,
            reference=data.get("reference", ""),
            charge_id=data.get("charge_id", ""),
            succeeded=event_type == _BACHS_SUCCESS,
            valid=bool(payload.get("id")),
        )
    return paystack.parse_webhook(payload)


def list_ledger() -> list[dict]:
    """Normalised to ``{reference, amount_kobo, succeeded}`` for reconciliation."""
    if is_bachs():
        return [
            {
                "reference": r.get("reference", ""),
                "amount_kobo": bachs.naira_str_to_kobo(str(r.get("amount", "0"))),
                "succeeded": bachs.charge_succeeded(str(r.get("status", ""))),
            }
            for r in bachs.list_ledger()
        ]
    return paystack.list_ledger()
