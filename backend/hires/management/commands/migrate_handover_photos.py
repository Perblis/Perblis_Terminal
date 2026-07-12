"""One-shot operator command: move handover photos public → private (D-025).

Handover photos shipped to the public bucket while FSD §7.4 specified private;
D-025 makes the spec binding. This copies every attached photo key from the
public store to the private one (verify, then delete the public object). Safe
to re-run: keys already private are skipped, and keys missing from both stores
are logged and left alone. Run once post-deploy; new uploads already presign
against the private bucket.
"""

from __future__ import annotations

import structlog
from django.core.management.base import BaseCommand

from core import media
from hires.models import HandoverRecord

logger = structlog.get_logger(__name__)

_CONTENT_TYPES = {"jpg": "image/jpeg", "png": "image/png", "webp": "image/webp"}


class Command(BaseCommand):
    help = "Move existing handover photos from the public bucket to the private one (D-025)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Report what would move without touching storage.",
        )

    def handle(self, *args, **options):
        dry_run: bool = options["dry_run"]
        moved = skipped = missing = 0

        keys: set[str] = set()
        for record in HandoverRecord.objects.exclude(photos=[]).iterator():
            keys.update(record.photos)

        for key in sorted(keys):
            if media.private_file_exists(key):
                skipped += 1
                continue
            try:
                content = media.read_public_file(key)
            except Exception:  # noqa: BLE001 — gone from both stores; log and move on
                logger.warning("handover_migrate.key_missing", key=key)
                missing += 1
                continue
            if dry_run:
                moved += 1
                self.stdout.write(f"would move {key}")
                continue
            ext = key.rsplit(".", 1)[-1].lower()
            content_type = _CONTENT_TYPES.get(ext, "application/octet-stream")
            media.store_private_file(key, content, content_type)
            if media.read_private_file(key) != content:  # verify before deleting the source
                raise RuntimeError(f"verification failed for {key}; public copy retained")
            media.delete_public_file(key)
            moved += 1
            logger.info("handover_migrate.moved", key=key)

        prefix = "[dry-run] " if dry_run else ""
        self.stdout.write(
            self.style.SUCCESS(
                f"{prefix}handover photos: {moved} moved, {skipped} already private, "
                f"{missing} missing"
            )
        )
