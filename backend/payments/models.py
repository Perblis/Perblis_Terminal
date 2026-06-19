"""Payments models (TSD §3.3, D-017 — Bachs.io collect-only).

``Payment`` is one checkout attempt against a hire; ``PaymentEvent`` is the
deduplicated webhook log (Bachs delivers at-least-once); ``Refund`` tracks money
returned to the hirer per FSD §7.6. All amounts are integer kobo (commandment 2);
the naira-string boundary lives only in ``payments.bachs``.
"""

from __future__ import annotations

from django.db import models

from core.models import BaseModel
from hires.models import Hire

from .enums import PaymentState, PayoutKind, PayoutState, RefundState


class Payment(BaseModel):
    """A single Bachs checkout attempt for a hire (≤3 within the 4h window)."""

    hire = models.ForeignKey(Hire, on_delete=models.PROTECT, related_name="payments")
    reference = models.CharField(max_length=64, unique=True)
    charge_id = models.CharField(max_length=128, blank=True)
    authorization_url = models.TextField(blank=True)
    amount = models.BigIntegerField()  # kobo — equals hire.hire_value
    state = models.CharField(
        max_length=16, choices=PaymentState.choices, default=PaymentState.INITIATED
    )
    attempt = models.PositiveSmallIntegerField(default=1)
    channel = models.CharField(max_length=32, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [models.Index(fields=["hire", "state"])]

    def __str__(self) -> str:
        return f"{self.reference} ({self.state})"


class PaymentEvent(BaseModel):
    """A received Bachs webhook, deduplicated on the envelope id (at-least-once)."""

    event_id = models.CharField(max_length=128, unique=True)
    event_type = models.CharField(max_length=64)
    payload = models.JSONField(default=dict)
    processed_at = models.DateTimeField(null=True, blank=True)

    def __str__(self) -> str:
        return f"{self.event_type}:{self.event_id}"


class Refund(BaseModel):
    """Money returned to the hirer for a cancelled/disputed hire (FSD §7.6)."""

    hire = models.ForeignKey(Hire, on_delete=models.PROTECT, related_name="refunds")
    amount = models.BigIntegerField()  # kobo
    state = models.CharField(
        max_length=16, choices=RefundState.choices, default=RefundState.PENDING
    )
    provider_ref = models.CharField(max_length=128, blank=True)
    reason = models.CharField(max_length=64, blank=True)

    class Meta:
        indexes = [models.Index(fields=["hire", "state"])]

    def __str__(self) -> str:
        return f"refund {self.amount} for hire {self.hire_id} ({self.state})"


class Payout(BaseModel):
    """What Terminal owes a supplier for a hire (FSD §3.2).

    Created ``due`` on completion (``payout_amount``) — the founder pays out
    weekly via the Ops queue and records a reference. The one exception (D-015)
    is the withheld-day payout on a late hirer cancellation. A dispute freezes
    the payout until resolution. One completion payout per hire (unique).
    """

    hire = models.ForeignKey(Hire, on_delete=models.PROTECT, related_name="payouts")
    supplier = models.ForeignKey("accounts.User", on_delete=models.PROTECT, related_name="payouts")
    amount = models.BigIntegerField()  # kobo
    kind = models.CharField(
        max_length=16, choices=PayoutKind.choices, default=PayoutKind.COMPLETION
    )
    state = models.CharField(
        max_length=16, choices=PayoutState.choices, default=PayoutState.PENDING
    )
    paid_ref = models.CharField(max_length=128, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    frozen_reason = models.CharField(max_length=64, blank=True)

    class Meta:
        constraints = [
            # At most one completion payout per hire (the withheld-day payout is
            # a distinct kind, so both can coexist for a late-cancelled hire).
            models.UniqueConstraint(fields=["hire", "kind"], name="uniq_payout_per_hire_kind")
        ]
        indexes = [models.Index(fields=["supplier", "state"]), models.Index(fields=["state"])]

    def __str__(self) -> str:
        return f"payout {self.amount} to {self.supplier_id} ({self.state})"
