"""Concurrency-safe deploy-time database tasks (migrate + superuser seed).

Both the Railway *web* (api) and *worker* services run their database
pre-deploy step on every deploy. Without coordination the two ``migrate``
processes race: one wins and creates a table (e.g. ``listings``), while the
other has already read the pre-migration state and then dies trying to
re-create it with

    duplicate key value violates unique constraint "pg_type_typname_nsp_index"

Because that loser is a service's pre-deploy step, the whole deploy fails and
the previous image keeps serving (a green ``/healthz`` on stale code). The
``seed_superuser`` step is likewise check-then-create and not safe to run
concurrently.

This command serializes both behind a PostgreSQL *session-level* advisory
lock: the first process runs ``migrate`` + the superuser seed, the second
waits on the lock and then re-runs them as a no-op. The lock is held on the
default connection's session for the duration of the command and always
released, even on error.
"""

from __future__ import annotations

from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.db import connection

# Stable, arbitrary positive 63-bit key shared by every service's deploy
# step. Ascii for "TERMINL" (7 bytes => fits comfortably in a bigint).
_ADVISORY_LOCK_KEY = 0x5445524D494E4C


class Command(BaseCommand):
    help = (
        "Run migrate + seed_superuser under a Postgres advisory lock so "
        "concurrent service deploys cannot race on schema creation."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--noinput",
            "--no-input",
            action="store_false",
            dest="interactive",
            help="Do not prompt for input of any kind (passed through to migrate).",
        )

    def handle(self, *args, **options):
        interactive = options["interactive"]
        verbosity = options["verbosity"]

        with connection.cursor() as cursor:
            cursor.execute("SELECT pg_advisory_lock(%s)", [_ADVISORY_LOCK_KEY])
            self.stdout.write("Acquired deploy advisory lock; running migrations.")
            try:
                call_command("migrate", interactive=interactive, verbosity=verbosity)
                call_command("seed_superuser", verbosity=verbosity)
            finally:
                cursor.execute("SELECT pg_advisory_unlock(%s)", [_ADVISORY_LOCK_KEY])
                self.stdout.write("Released deploy advisory lock.")
