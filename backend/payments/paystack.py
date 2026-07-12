"""Paystack adapter — collect-only (D-018, supersedes Bachs in D-017).

Conforms to the provider-neutral interface in ``payments.contracts`` /
``payments.gateway``. Paystack speaks **integer kobo natively** (no decimal
conversion). Webhooks are signed **HMAC-SHA512 of the raw body with the secret
key** (header ``x-paystack-signature`` — no timestamp). Verification is by our
``reference`` via ``GET /transaction/verify/{reference}``.

"Simulate integrations, never simulate trust": with no ``PAYSTACK_SECRET_KEY``
(dev/CI) checkout returns a visible stub URL and verification reports not-ok, so
a hire can never be confirmed without a real, verified charge.
"""

from __future__ import annotations

import hashlib
import hmac
from collections.abc import Mapping

import httpx
import structlog
from django.conf import settings

from .contracts import CURRENCY, Charge, WebhookEvent

logger = structlog.get_logger(__name__)

_TIMEOUT = 15.0
SUCCESS_EVENT = "charge.success"


def configured() -> bool:
    return bool(settings.PAYSTACK_SECRET_KEY)


def _headers() -> dict:
    return {"Authorization": f"Bearer {settings.PAYSTACK_SECRET_KEY}"}


def _base() -> str:
    return settings.PAYSTACK_API_BASE


def create_checkout(*, reference: str, amount_kobo: int, customer_email: str, hire_id: str) -> dict:
    """Initialize a transaction. Returns ``{authorization_url, charge_id}``.

    Keyless dev/CI returns a visible stub URL (no network, never 'paid').
    """
    if not configured():
        stub = f"https://checkout.paystack.invalid/{reference}"
        logger.info("paystack.checkout_stub", reference=reference, url=stub)
        return {"authorization_url": stub, "charge_id": ""}

    payload = {
        "email": customer_email,
        "amount": amount_kobo,  # Paystack amounts are integer kobo
        "currency": CURRENCY,
        "reference": reference,
        "channels": ["card", "bank", "ussd", "bank_transfer"],
        "metadata": {"hire_id": hire_id},
    }
    # Where Paystack redirects the payer's browser after checkout (UX only;
    # confirmation stays webhook-driven). Paystack appends ?reference=&trxref=.
    callback_url = _callback_url(hire_id)
    if callback_url:
        payload["callback_url"] = callback_url

    try:
        resp = httpx.post(
            f"{_base()}/transaction/initialize",
            headers=_headers(),
            json=payload,
            timeout=_TIMEOUT,
        )
        resp.raise_for_status()
        data = resp.json().get("data", {})
    except httpx.HTTPError:
        logger.exception("paystack.checkout_failed", reference=reference)
        from .errors import CheckoutUnavailable

        raise CheckoutUnavailable() from None
    return {
        "authorization_url": data.get("authorization_url", ""),
        "charge_id": str(data.get("id", "")),
    }


def _callback_url(hire_id: str) -> str:
    """The post-checkout browser redirect for this transaction.

    Prefer the app-return page (deep-links the payer back into the hirer app);
    fall back to the static portal URL while ``PAYMENT_RETURN_BASE_URL`` is
    unset. Paystack requires an http(s) URL here — the custom app scheme lives
    behind the return page, never in the callback itself.
    """
    base = settings.PAYMENT_RETURN_BASE_URL
    if base:
        return f"{base.rstrip('/')}/api/v1/payments/return?hire_id={hire_id}"
    return settings.PAYSTACK_CALLBACK_URL


def verify_charge(*, reference: str, charge_id: str = "") -> Charge:
    """Verify by reference (Paystack's verify endpoint). ``charge_id`` is unused."""
    if not configured() or not reference:
        return Charge(ok=False)
    try:
        resp = httpx.get(
            f"{_base()}/transaction/verify/{reference}", headers=_headers(), timeout=_TIMEOUT
        )
        resp.raise_for_status()
        data = resp.json().get("data", {})
    except httpx.HTTPError:
        logger.exception("paystack.verify_failed", reference=reference)
        return Charge(ok=False)
    return Charge(
        ok=True,
        succeeded=data.get("status") == "success",
        amount_kobo=int(data.get("amount") or 0),
        currency=data.get("currency", ""),
    )


def create_refund(*, reference: str, charge_id: str, amount_kobo: int, reason: str) -> dict:
    """Refund a transaction (by reference). Returns ``{ok, provider_ref}``."""
    if not configured() or not reference:
        logger.info("paystack.refund_stub", reference=reference, amount_kobo=amount_kobo)
        return {"ok": False, "provider_ref": ""}
    try:
        resp = httpx.post(
            f"{_base()}/refund",
            headers=_headers(),
            json={"transaction": reference, "amount": amount_kobo, "merchant_note": reason},
            timeout=_TIMEOUT,
        )
        resp.raise_for_status()
        data = resp.json().get("data", {})
    except httpx.HTTPError:
        logger.exception("paystack.refund_failed", reference=reference)
        return {"ok": False, "provider_ref": ""}
    return {"ok": True, "provider_ref": str(data.get("id", ""))}


def verify_signature(*, headers: Mapping, raw_body: bytes) -> bool:
    """HMAC-SHA512 of the raw body with the secret key (``x-paystack-signature``)."""
    secret = settings.PAYSTACK_SECRET_KEY
    signature = headers.get("x-paystack-signature") or headers.get("X-Paystack-Signature")
    if not secret or not signature:
        return False
    expected = hmac.new(secret.encode(), raw_body, hashlib.sha512).hexdigest()
    return hmac.compare_digest(expected, signature)


def parse_webhook(payload: dict) -> WebhookEvent:
    event_type = payload.get("event", "")
    data = payload.get("data", {}) or {}
    reference = data.get("reference", "")
    # Paystack envelopes carry no top-level event id; (event, reference) is unique
    # enough for our one-success-per-reference flow.
    return WebhookEvent(
        dedup_id=f"paystack:{event_type}:{reference}",
        event_type=event_type,
        reference=reference,
        charge_id=str(data.get("id", "")),
        succeeded=event_type == SUCCESS_EVENT,
        valid=bool(reference),
    )


def list_ledger() -> list[dict]:
    """Successful transactions, normalised to ``{reference, amount_kobo, succeeded}``."""
    if not configured():
        return []
    try:
        resp = httpx.get(
            f"{_base()}/transaction",
            headers=_headers(),
            params={"status": "success", "perPage": 200},
            timeout=_TIMEOUT,
        )
        resp.raise_for_status()
        rows = resp.json().get("data", [])
    except httpx.HTTPError:
        logger.exception("paystack.ledger_failed")
        return []
    return [
        {
            "reference": r.get("reference", ""),
            "amount_kobo": int(r.get("amount") or 0),
            "succeeded": r.get("status") == "success",
        }
        for r in rows
    ]


def sign(raw_body: bytes, secret: str) -> str:
    """Compute a Paystack signature — used by tests and tooling."""
    return hmac.new(secret.encode(), raw_body, hashlib.sha512).hexdigest()
