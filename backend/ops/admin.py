"""Ops Console admin registrations (wave-6 §6.8).

The reconciliation report: a read-only history of daily runs with drill-down
into the mismatch detail. Runs are written by ``payments.tasks.daily_reconciliation``.
"""

from __future__ import annotations

from django.contrib import admin

from ops.models import ReconciliationRun


@admin.register(ReconciliationRun)
class ReconciliationRunAdmin(admin.ModelAdmin):
    list_display = ("run_at", "checked", "mismatch_count", "is_clean")
    list_filter = ("mismatch_count",)
    readonly_fields = ("run_at", "checked", "mismatch_count", "is_clean", "mismatches")
    ordering = ("-run_at",)

    def has_add_permission(self, request) -> bool:
        return False  # written only by the reconciliation task

    def has_change_permission(self, request, obj=None) -> bool:
        return False  # read-only history

    @admin.display(boolean=True, description="Clean")
    def is_clean(self, obj: ReconciliationRun) -> bool:
        return obj.is_clean
