"""Run the timed hire transitions once (TSD §3.5).

A scheduler (Railway cron) invokes this every ~5 minutes. Idempotent, so an
overlapping or repeated run is harmless.

    manage.py run_hire_sweeps
"""

from __future__ import annotations

from django.core.management.base import BaseCommand

from hires.tasks import run_due_transitions, send_due_reminders


class Command(BaseCommand):
    help = "Run the idempotent hire-lifecycle sweeps + due reminders."

    def handle(self, *args, **opts):
        result = run_due_transitions()
        result.update(send_due_reminders())
        self.stdout.write(self.style.SUCCESS(f"Sweeps complete: {result}"))
