"""Create the Ops superuser from SEED_SUPERUSER_* env vars.

Idempotent and safe to run on every deploy (e.g. a Railway release step):
if the env vars aren't fully set, or a user with that email already exists,
it does nothing. It never resets an existing user's password.

This seeds a Django *staff/superuser* for Ops Console access only — it does
not fake hirer/supplier verification (commandment 10): account_level stays
`basic` and the real verification flow is untouched.

Required env vars:
  SEED_SUPERUSER_EMAIL · SEED_SUPERUSER_PHONE (E.164) · SEED_SUPERUSER_PASSWORD
"""

from __future__ import annotations

import os

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Create the Ops superuser from SEED_SUPERUSER_* env vars (idempotent)."

    def handle(self, *args, **options) -> None:
        email = os.environ.get("SEED_SUPERUSER_EMAIL")
        phone = os.environ.get("SEED_SUPERUSER_PHONE")
        password = os.environ.get("SEED_SUPERUSER_PASSWORD")

        if not (email and phone and password):
            self.stdout.write("SEED_SUPERUSER_* not fully set; skipping superuser seed.")
            return

        user_model = get_user_model()
        if user_model.objects.filter(email=email).exists():
            self.stdout.write(f"Superuser {email} already exists; skipping.")
            return

        user_model.objects.create_superuser(email=email, phone=phone, password=password)
        self.stdout.write(self.style.SUCCESS(f"Created superuser {email}."))
