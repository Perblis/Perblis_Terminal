"""Provider-neutral payment contracts shared by the gateway and adapters.

Every payment provider (Bachs, Paystack) is normalised to these shapes so the
services and the webhook view never branch on the provider. Money is integer
kobo at this boundary (each adapter converts to/from its own wire format).
"""

from __future__ import annotations

from dataclasses import dataclass

CURRENCY = "NGN"


@dataclass(frozen=True)
class Charge:
    """The normalised result of verifying a charge with the provider."""

    ok: bool  # the provider could be reached/verified at all
    succeeded: bool = False  # the charge is in a terminal success state
    amount_kobo: int = 0
    currency: str = ""


@dataclass(frozen=True)
class WebhookEvent:
    """A parsed webhook envelope, provider-neutral."""

    dedup_id: str  # stable id for idempotent dedup
    event_type: str  # provider-native type (stored for audit)
    reference: str  # our payment reference
    charge_id: str  # provider charge/transaction id (may be "")
    succeeded: bool  # is this the payment-success event?
    valid: bool = True  # the envelope parsed
