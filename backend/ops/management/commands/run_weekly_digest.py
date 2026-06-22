"""Send the weekly founder digest. Invoked weekly by Railway cron."""

from __future__ import annotations

from django.core.management.base import BaseCommand

from ops.tasks import send_weekly_digest


class Command(BaseCommand):
    help = "Build and email the weekly Ops metrics digest (FSD §6.8)."

    def handle(self, *args, **opts) -> None:
        result = send_weekly_digest.enqueue()
        self.stdout.write(self.style.SUCCESS(f"Weekly digest enqueued: {result}"))
