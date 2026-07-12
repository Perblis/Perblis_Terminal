"""Run the D-026 handover-photo retention purge once.

A scheduler (Railway cron, daily) invokes this. Idempotent — purged records
carry ``photos_purged_at`` and leave the candidate set, so an overlapping or
repeated run deletes nothing.

    manage.py run_handover_photo_purge
"""

from __future__ import annotations

from django.core.management.base import BaseCommand

from hires.tasks import purge_due_handover_photos


class Command(BaseCommand):
    help = "Purge handover photos 90 days after off-hire confirmation (D-026)."

    def handle(self, *args, **opts):
        result = purge_due_handover_photos()
        self.stdout.write(self.style.SUCCESS(f"Handover-photo purge complete: {result}"))
