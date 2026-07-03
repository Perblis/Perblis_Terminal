"""Seed deterministic fixtures for the portal's Playwright E2E runs (TSD §8).

Creates a fully-verified supplier (profile + yard + Live listing), a hirer, a
Requested hire (the F4 accept flow) and a Confirmed hire (the refund-preview
parity spec). DEBUG-only and idempotent: re-runs reuse the seeded users and only
top up missing records. Prints a JSON summary for the test harness.

This is test scaffolding, not simulated trust: it refuses to run outside DEBUG,
exactly like ``E2E_FIXED_OTP``.
"""

from __future__ import annotations

import datetime as dt
import json

from django.conf import settings
from django.contrib.gis.geos import Point
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

E2E_PASSWORD = "e2e-password-1234"
SUPPLIER_EMAIL = "supplier@e2e.terminal.test"
HIRER_EMAIL = "hirer@e2e.terminal.test"


class Command(BaseCommand):
    help = "Seed deterministic E2E fixtures (DEBUG-only, idempotent)."

    @transaction.atomic
    def handle(self, *args, **options):
        if not settings.DEBUG:
            raise CommandError("seed_e2e is a test harness — it refuses to run outside DEBUG.")

        from accounts.models import AccountLevel, User
        from hires import services as hire_services
        from hires import state
        from hires.enums import ActorKind, HireStatus
        from listings.enums import ListingStatus
        from listings.models import Listing, ListingPhoto
        from suppliers.models import SupplierProfile, Yard

        supplier, _ = User.objects.get_or_create(
            email=SUPPLIER_EMAIL,
            defaults={
                "full_name": "E2E Supplier",
                "phone": "+2348090000001",
                "is_supplier": True,
                "is_hirer": False,
                "account_level": AccountLevel.VERIFIED,
                "phone_verified_at": timezone.now(),
                "email_verified_at": timezone.now(),
            },
        )
        supplier.set_password(E2E_PASSWORD)
        supplier.save(update_fields=["password"])

        hirer, _ = User.objects.get_or_create(
            email=HIRER_EMAIL,
            defaults={
                "full_name": "E2E Hirer",
                "phone": "+2348090000002",
                "is_supplier": False,
                "is_hirer": True,
                "account_level": AccountLevel.VERIFIED,
                "phone_verified_at": timezone.now(),
                "email_verified_at": timezone.now(),
            },
        )
        hirer.set_password(E2E_PASSWORD)
        hirer.save(update_fields=["password"])

        SupplierProfile.objects.get_or_create(
            user=supplier,
            defaults={
                "business_name": "E2E Heavy Lift Ltd",
                "description": "Deterministic plant and machinery for end-to-end tests.",
                "bank_name": "Zenith Bank",
                "bank_account_number_enc": "0123456789",
                "bank_account_name": "E2E Heavy Lift Ltd",
            },
        )

        yard, _ = Yard.objects.get_or_create(
            supplier=supplier,
            name="E2E Apapa Yard",
            defaults={
                "point": Point(3.3792, 6.4433, srid=4326),
                "address_text": "Apapa Industrial Estate, Lagos",
                "city": "Lagos",
            },
        )

        listing = Listing.objects.filter(supplier=supplier, title="E2E CAT 320D Excavator").first()
        if listing is None:
            # Seeded directly at Live (fixture creation, like the test factories);
            # the F9 publish-gates journey builds its own listing through the UI.
            listing = Listing.objects.create(
                supplier=supplier,
                yard=yard,
                asset_class="plant_machinery",
                asset_type="Excavator",
                title="E2E CAT 320D Excavator",
                description="Well-maintained CAT 320D with operator, seeded for E2E runs. "
                "Hour meter verified; deterministic fixture data.",
                specs={},
                daily_price=8_000_000,  # ₦80,000/day in kobo
                unit_count=2,
                status=ListingStatus.LIVE,
                point=yard.point,
                address_text=yard.address_text,
                city=yard.city,
            )
            ListingPhoto.objects.create(
                listing=listing, r2_key="e2e/listing-cover.jpg", position=0, is_cover=True
            )

        today = timezone.localdate()

        requested = listing.hires.filter(status=HireStatus.REQUESTED, hirer=hirer).first()
        if requested is None:
            requested = hire_services.create_hire(
                user=hirer,
                listing_id=listing.id,
                start_date=today + dt.timedelta(days=7),
                end_date=today + dt.timedelta(days=9),
                hirer_note="E2E requested hire — accept-flow fixture.",
            )

        confirmed = listing.hires.filter(status=HireStatus.CONFIRMED, hirer=hirer).first()
        if confirmed is None:
            # Start >72h out so the refund-preview branch is deterministic
            # (hirer_cancel_full / supplier_cancel_full per FSD §7.6).
            confirmed = hire_services.create_hire(
                user=hirer,
                listing_id=listing.id,
                start_date=today + dt.timedelta(days=30),
                end_date=today + dt.timedelta(days=33),
                hirer_note="E2E confirmed hire — refund-preview fixture.",
            )
            state.apply(confirmed, "accept", actor=supplier, actor_kind=str(ActorKind.USER))
            state.apply(confirmed, "pay", actor=None, actor_kind=str(ActorKind.SYSTEM))

        summary = {
            "password": E2E_PASSWORD,
            "supplier": {"email": SUPPLIER_EMAIL, "id": str(supplier.id)},
            "hirer": {"email": HIRER_EMAIL, "id": str(hirer.id)},
            "yard_id": str(yard.id),
            "listing_id": str(listing.id),
            "requested_hire_id": str(requested.id),
            "confirmed_hire_id": str(confirmed.id),
        }
        self.stdout.write(json.dumps(summary, indent=2))
