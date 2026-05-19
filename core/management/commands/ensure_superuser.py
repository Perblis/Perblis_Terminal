"""
Idempotent superuser bootstrap for Railway / CI.

Set SEED_SUPERUSER_EMAIL and SEED_SUPERUSER_PASSWORD in the service environment.
If either is missing, this command is a no-op (exit 0).

Optional: SEED_SUPERUSER_PHONE, SEED_SUPERUSER_FIRST_NAME, SEED_SUPERUSER_LAST_NAME
"""

import os

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

User = get_user_model()


class Command(BaseCommand):
    help = 'Create or update a Django admin superuser when SEED_SUPERUSER_* env vars are set.'

    def handle(self, *args, **options):
        email = (os.environ.get('SEED_SUPERUSER_EMAIL') or '').strip()
        password = os.environ.get('SEED_SUPERUSER_PASSWORD') or ''
        if not email or not password:
            self.stdout.write(
                'ensure_superuser: SEED_SUPERUSER_EMAIL / SEED_SUPERUSER_PASSWORD not set; skipping.'
            )
            return

        phone = (os.environ.get('SEED_SUPERUSER_PHONE') or '+2348000000999').strip()
        first_name = (os.environ.get('SEED_SUPERUSER_FIRST_NAME') or 'Admin').strip() or 'Admin'
        last_name = (os.environ.get('SEED_SUPERUSER_LAST_NAME') or 'User').strip() or 'User'

        user, created = User.objects.get_or_create(
            email=email,
            defaults={
                'phone': phone,
                'first_name': first_name,
                'last_name': last_name,
                'is_owner': True,
                'is_renter': True,
                'is_email_verified': True,
                'is_phone_verified': True,
            },
        )
        user.set_password(password)
        user.is_staff = True
        user.is_superuser = True
        user.is_active = True
        user.save()

        action = 'Created' if created else 'Updated'
        self.stdout.write(self.style.SUCCESS(f'ensure_superuser: {action} staff superuser for {email}'))
