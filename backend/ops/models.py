"""Ops Console models.

The Ops Console is overwhelmingly a *surface* over models built in earlier
waves; the only state it owns is operational history. ``ReconciliationRun``
persists each daily payment-reconciliation pass (TSD §3.5) so the dashboard and
the reconciliation report can render run history and drill into mismatches —
the daily task previously only logged to Sentry.
"""

from __future__ import annotations

from django.db import models

from core.models import BaseModel


class ReconciliationRun(BaseModel):
    """One daily reconciliation pass: local SUCCESS payments vs the gateway ledger."""

    run_at = models.DateTimeField(auto_now_add=True)
    # How many local SUCCESS payments were checked against the ledger.
    checked = models.PositiveIntegerField(default=0)
    mismatch_count = models.PositiveIntegerField(default=0)
    # List of {reference, issue, ...} dicts as returned by payments.reconcile().
    mismatches = models.JSONField(default=list, blank=True)

    class Meta:
        ordering = ("-run_at",)

    def __str__(self) -> str:
        return f"Reconciliation {self.run_at:%Y-%m-%d %H:%M} ({self.mismatch_count} mismatches)"

    @property
    def is_clean(self) -> bool:
        return self.mismatch_count == 0
