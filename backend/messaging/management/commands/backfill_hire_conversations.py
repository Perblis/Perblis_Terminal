"""Backfill hire conversations for accepted hires that predate Wave 5.

The Wave 4C stub never created hire conversations; this recovers the gap (and
any hire whose post-commit auto-create failed). Idempotent — re-running is a
no-op thanks to the unique ``hire`` index.

    manage.py backfill_hire_conversations
"""

from __future__ import annotations

from django.core.management.base import BaseCommand

from hires.enums import HireStatus
from hires.models import Hire
from messaging.services import ensure_hire_conversation


class Command(BaseCommand):
    help = "Create missing conversations for hires that have been accepted."

    def handle(self, *args, **opts):
        # Any hire that has ever been accepted should own a conversation.
        accepted = (
            Hire.objects.filter(events__to_status=str(HireStatus.ACCEPTED))
            .filter(conversation__isnull=True)
            .distinct()
        )
        created = 0
        for hire in accepted.iterator():
            ensure_hire_conversation(hire)
            created += 1
        self.stdout.write(self.style.SUCCESS(f"Backfilled {created} hire conversation(s)."))
