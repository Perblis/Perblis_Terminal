"""Hires models (FSD §7, TSD §3.3).

The ``Hire`` is the transaction — the product is the transaction record. Its
``status`` is written **only** by ``hires.state.apply`` (the state machine), and
every transition appends an immutable ``HireEvent``. The financial fields
(``hire_value``, ``service_fee``, ``payout_amount``, ``fee_basis``, ``scheme``)
are computed for preview at request time and **locked at acceptance** — they
never mutate thereafter (FSD §3.1; corrections are Refund/Ops records).
"""

from __future__ import annotations

from django.conf import settings
from django.db import models

from core.models import BaseModel

from .enums import ActorKind, CancelledBy, HandoverKind, HireStatus, Scheme


class Hire(BaseModel):
    """A hirer's request to hire a listing for a date range (FSD §7)."""

    listing = models.ForeignKey("listings.Listing", on_delete=models.PROTECT, related_name="hires")
    hirer = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="hires_as_hirer"
    )
    # Denormalised at request time so the record stands alone (FSD §3.3).
    supplier = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="hires_as_supplier"
    )
    yard = models.ForeignKey(
        "suppliers.Yard", on_delete=models.SET_NULL, null=True, blank=True, related_name="hires"
    )

    start_date = models.DateField()
    end_date = models.DateField()
    duration_days = models.PositiveIntegerField()

    # --- financials: computed at request for preview, LOCKED at acceptance ---
    scheme = models.CharField(max_length=16, choices=Scheme.choices)
    fee_basis = models.CharField(max_length=64)
    hire_value = models.BigIntegerField()  # kobo — what the hirer pays
    service_fee = models.BigIntegerField()  # kobo — Terminal revenue (D-014 confidential)
    payout_amount = models.BigIntegerField()  # kobo — what the supplier receives

    status = models.CharField(
        max_length=16, choices=HireStatus.choices, default=HireStatus.REQUESTED
    )
    cancelled_by = models.CharField(
        max_length=16, choices=CancelledBy.choices, null=True, blank=True
    )
    decline_reason = models.CharField(max_length=255, blank=True)
    cancel_reason = models.CharField(max_length=255, blank=True)

    hirer_note = models.TextField(blank=True)
    request_expires_at = models.DateTimeField()
    payment_deadline = models.DateTimeField(null=True, blank=True)
    # Operator/driver acknowledgments recorded at accept where applicable (FSD §7.2).
    acknowledgments = models.JSONField(default=dict, blank=True)
    # Extensions hang a child hire off the parent (Phase 2; field present now).
    parent_hire = models.ForeignKey(
        "self", on_delete=models.SET_NULL, null=True, blank=True, related_name="extensions"
    )

    class Meta:
        indexes = [
            # Hot path: the availability overlap query (TSD §3.4).
            models.Index(fields=["listing", "status", "start_date", "end_date"]),
            models.Index(fields=["hirer", "status"]),
            models.Index(fields=["supplier", "status"]),
        ]

    def __str__(self) -> str:
        return f"Hire {self.id} ({self.status})"


class HireEvent(BaseModel):
    """Append-only audit of every state transition (FSD §7.3).

    The table is the immutable history of the transaction. Append-only is
    enforced at the application layer here (``save`` rejects updates, ``delete``
    is forbidden) and reinforced by a DB-level ``REVOKE UPDATE, DELETE`` in the
    migration for deployments that run under a restricted (non-superuser) role.
    """

    hire = models.ForeignKey(Hire, on_delete=models.PROTECT, related_name="events")
    actor_kind = models.CharField(max_length=8, choices=ActorKind.choices)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="hire_events",
    )
    from_status = models.CharField(max_length=16, choices=HireStatus.choices, blank=True)
    to_status = models.CharField(max_length=16, choices=HireStatus.choices)
    meta = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["created_at"]
        indexes = [models.Index(fields=["hire", "created_at"])]

    def save(self, *args, **kwargs):
        if not self._state.adding:
            raise RuntimeError("hire_events is append-only; updates are not permitted")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise RuntimeError("hire_events is append-only; deletes are not permitted")

    def __str__(self) -> str:
        return f"{self.hire_id}: {self.from_status}→{self.to_status}"


class HandoverRecord(BaseModel):
    """On-hire / off-hire evidence (FSD §7.4). Confirmed by the counterparty.

    Endpoints + business logic land in slice 4E; the model is created here so
    the hire schema is migrated once.
    """

    hire = models.ForeignKey(Hire, on_delete=models.PROTECT, related_name="handovers")
    kind = models.CharField(max_length=16, choices=HandoverKind.choices)
    photos = models.JSONField(default=list, blank=True)  # private-bucket object keys
    reading = models.JSONField(default=dict, blank=True)  # hour meter / odometer / none
    submitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="handovers_submitted",
    )
    confirmed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="handovers_confirmed",
    )
    confirmed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [models.Index(fields=["hire", "kind"])]

    def __str__(self) -> str:
        return f"{self.kind} handover for hire {self.hire_id}"
