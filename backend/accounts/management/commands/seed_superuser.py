"""Create or promote the Ops superuser from SEED_SUPERUSER_* env vars.

Idempotent and safe to run on every deploy (e.g. a Railway release step).
If the env vars aren't fully set, it does nothing.

When the email already exists as a normal account (common after Wave 1
registration), the user is promoted to staff/superuser and the password is set
from ``SEED_SUPERUSER_PASSWORD`` once. Already-promoted superusers keep their
password on subsequent runs.

This seeds Django *staff/superuser* for Ops Console access only — it does not
fake hirer/supplier verification (commandment 10): account_level stays
``basic`` and the real verification flow is untouched.

Required env vars:
  SEED_SUPERUSER_EMAIL · SEED_SUPERUSER_PHONE (E.164) · SEED_SUPERUSER_PASSWORD
"""

from __future__ import annotations

import os

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Create or promote the Ops superuser from SEED_SUPERUSER_* env vars (idempotent)."

    def handle(self, *args, **options) -> None:
        email = os.environ.get("SEED_SUPERUSER_EMAIL")
        phone = os.environ.get("SEED_SUPERUSER_PHONE")
        password = os.environ.get("SEED_SUPERUSER_PASSWORD")

        if not (email and phone and password):
            self.stdout.write("SEED_SUPERUSER_* not fully set; skipping superuser seed.")
            return

        user_model = get_user_model()
        existing = user_model.objects.filter(email__iexact=email).first()
        if existing is not None:
            if existing.is_staff and existing.is_superuser:
                self.stdout.write(f"Superuser {email} already exists; skipping.")
                return
            existing.is_staff = True
            existing.is_superuser = True
            existing.set_password(password)
            existing.save(update_fields=["is_staff", "is_superuser", "password"])
            self.stdout.write(self.style.SUCCESS(f"Promoted {email} to superuser."))
            return

        user_model.objects.create_superuser(email=email, phone=phone, password=password)
        self.stdout.write(self.style.SUCCESS(f"Created superuser {email}."))
