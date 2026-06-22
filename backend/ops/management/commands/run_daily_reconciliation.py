"""Run the daily payment reconciliation. Invoked daily by Railway cron."""

from __future__ import annotations

from django.core.management.base import BaseCommand

from payments.tasks import daily_reconciliation


class Command(BaseCommand):
    help = "Reconcile the provider ledger against local payments and persist the run (TSD §3.5)."

    def handle(self, *args, **opts) -> None:
        result = daily_reconciliation.enqueue()
        self.stdout.write(self.style.SUCCESS(f"Reconciliation enqueued: {result}"))
