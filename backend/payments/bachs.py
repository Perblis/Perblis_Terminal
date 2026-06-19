"""Bachs.io adapter — collect-only (D-017).

The single boundary between Terminal's domain (integer kobo) and Bachs (decimal
naira strings like ``"75000.00"``). Conversion happens *only* here. Every other
module speaks kobo.

API contract follows https://docs.bachs.io/ (Pure Checkout + Payins):
``POST /v1/checkouts`` with ``pricing`` + ``customer_email`` → ``checkout_url``;
``GET /v1/payments/payins/{charge_id}`` for verify-before-transition;
``POST /v1/payments/refunds`` for refunds; ``GET /v1/payments/payins`` for ledger.

"Simulate integrations, never simulate trust" (commandment 10): with no
``BACHS_SECRET_KEY`` configured (dev/CI) checkout returns a visible stub URL and
verification reports *not configured* — so a hire can never be auto-confirmed
without a real, verified charge. Webhook signatures are HMAC-SHA256 hex over
``"{timestamp}.{raw_body}"`` with the per-endpoint webhook secret, 5-minute
tolerance.
"""

from __future__ import annotations

import hashlib
import hmac
import time
from dataclasses import dataclass

import httpx
import structlog
from django.conf import settings

logger = structlog.get_logger(__name__)

CURRENCY = "NGN"
SIGNATURE_TOLERANCE = 300  # seconds (5 minutes)
_SUCCEEDED = frozenset({"succeeded", "SUCCEEDED"})
_TIMEOUT = 15.0


# --- money boundary (kobo <-> decimal-naira string) -------------------------
def kobo_to_naira_str(kobo: int) -> str:
    """123456 kobo -> "1234.56" (Bachs wants decimal naira)."""
    return f"{kobo // 100}.{kobo % 100:02d}"


def naira_str_to_kobo(value: str) -> int:
    """ "1234.56" -> 123456 kobo. Integer-only; never trusts a float."""
    whole, _, frac = str(value).partition(".")
    frac = (frac + "00")[:2]
    return int(whole) * 100 + int(frac)


@dataclass(frozen=True)
class Charge:
    ok: bool  # whether the provider could be reached/verified at all
    status: str = ""
    amount_kobo: int = 0
    currency: str = ""


def _headers() -> dict:
    return {"Authorization": f"Bearer {settings.BACHS_SECRET_KEY}"}


def configured() -> bool:
    return bool(settings.BACHS_SECRET_KEY)


def _is_sandbox_key() -> bool:
    return settings.BACHS_SECRET_KEY.startswith("sk_sandbox_")


def charge_succeeded(status: str) -> bool:
    """True when Bachs reports a successful payin (case-insensitive)."""
    return status in _SUCCEEDED


def create_checkout(*, reference: str, amount_kobo: int, hire_id: str, customer_email: str) -> dict:
    """Open an ad-hoc NGN checkout. Returns ``{authorization_url, charge_id}``.

    Keyless dev/CI returns a visible stub URL (no network, never 'paid').
    """
    if not configured():
        stub = f"https://sandbox.bachs.invalid/checkout/{reference}"
        logger.info("bachs.checkout_stub", reference=reference, url=stub)
        return {"authorization_url": stub, "charge_id": ""}

    payload: dict = {
        "pricing": {"currency": CURRENCY, "amount": kobo_to_naira_str(amount_kobo)},
        "customer_email": customer_email,
        "reference": reference,
        "metadata": {"hire_id": hire_id},
        "expires_in_minutes": 240,  # match the 4h payment window
    }
    if _is_sandbox_key():
        # Sandbox: auto-succeed so webhooks fire without a browser (docs.bachs.io).
        payload["simulated_outcome"] = "success"

    resp = httpx.post(
        f"{settings.BACHS_API_BASE}/checkouts",
        headers=_headers(),
        json=payload,
        timeout=_TIMEOUT,
    )
    resp.raise_for_status()
    data = resp.json()
    charge = data.get("charge") or {}
    charge_id = (
        charge.get("id", "")
        or charge.get("charge_id", "")
        or data.get("checkout_id", "")
        or data.get("charge_id", "")
    )
    return {
        "authorization_url": data.get("checkout_url") or data.get("authorization_url", ""),
        "charge_id": charge_id,
    }


def verify_charge(charge_id: str) -> Charge:
    """Verify a payin before transitioning a hire (D-017 verify-before-transition).

    Returns ``Charge(ok=False)`` when unconfigured or on any error, so the caller
    never transitions on an unverifiable charge.
    """
    if not configured() or not charge_id:
        return Charge(ok=False)
    try:
        resp = httpx.get(
            f"{settings.BACHS_API_BASE}/payments/payins/{charge_id}",
            headers=_headers(),
            timeout=_TIMEOUT,
        )
        resp.raise_for_status()
        data = resp.json()
    except httpx.HTTPError:
        logger.exception("bachs.verify_failed", charge_id=charge_id)
        return Charge(ok=False)
    amount = data.get("amount") or data.get("settlement_amount") or "0"
    currency = data.get("currency") or data.get("settlement_currency") or ""
    return Charge(
        ok=True,
        status=data.get("status", ""),
        amount_kobo=naira_str_to_kobo(amount),
        currency=currency,
    )


def create_refund(*, charge_id: str, amount_kobo: int, reason: str, reference: str) -> dict:
    """Refund (part of) a charge. Returns ``{ok, provider_ref}``."""
    if not configured() or not charge_id:
        logger.info("bachs.refund_stub", charge_id=charge_id, amount_kobo=amount_kobo)
        return {"ok": False, "provider_ref": ""}
    try:
        body: dict = {
            "charge_id": charge_id,
            "reference": reference,
            "reason": reason,
        }
        if amount_kobo > 0:
            body["amount"] = kobo_to_naira_str(amount_kobo)
        if _is_sandbox_key():
            body["simulated_outcome"] = "success"
        resp = httpx.post(
            f"{settings.BACHS_API_BASE}/payments/refunds",
            headers=_headers(),
            json=body,
            timeout=_TIMEOUT,
        )
        resp.raise_for_status()
        data = resp.json()
    except httpx.HTTPError:
        logger.exception("bachs.refund_failed", charge_id=charge_id)
        return {"ok": False, "provider_ref": ""}
    return {"ok": True, "provider_ref": data.get("refund_id", data.get("id", ""))}


def list_ledger() -> list[dict]:
    """Fetch the payin ledger for daily reconciliation. Empty when unconfigured."""
    if not configured():
        return []
    try:
        resp = httpx.get(
            f"{settings.BACHS_API_BASE}/payments/payins",
            headers=_headers(),
            timeout=_TIMEOUT,
        )
        resp.raise_for_status()
        data = resp.json()
    except httpx.HTTPError:
        logger.exception("bachs.ledger_failed")
        return []
    items = data.get("items", data) if isinstance(data, dict) else data
    if not isinstance(items, list):
        return []
    return [
        {
            "reference": row.get("reference", ""),
            "amount": row.get("amount", "0"),
            "status": str(row.get("status", "")).upper(),
        }
        for row in items
        if isinstance(row, dict)
    ]


def verify_signature(*, timestamp: str | None, raw_body: bytes, signature: str | None) -> bool:
    """HMAC-SHA256 hex over ``"{timestamp}.{raw_body}"`` within the time tolerance."""
    secret = settings.BACHS_WEBHOOK_SECRET
    if not secret or not timestamp or not signature:
        return False
    try:
        ts = int(timestamp)
    except (TypeError, ValueError):
        return False
    if abs(time.time() - ts) > SIGNATURE_TOLERANCE:
        return False
    signed = timestamp.encode() + b"." + raw_body
    expected = hmac.new(secret.encode(), signed, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


def sign(timestamp: str, raw_body: bytes, secret: str) -> str:
    """Compute the signature for ``raw_body`` — used by tests and tooling."""
    return hmac.new(
        secret.encode(), timestamp.encode() + b"." + raw_body, hashlib.sha256
    ).hexdigest()
