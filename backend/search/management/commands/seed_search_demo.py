"""Seed dual-corridor demo listings for the search performance pass + founder demo.

Generates ~N Live listings across yards in two Lagos corridors (Apapa and
Lekki), distributed so the map shows a realistic mix of yard pins (≥2 listings)
and solo pins, spanning all five asset classes with a numeric ★ headline spec
on each (so spec-range filters demo too). This is a **demo/benchmark seeder**,
not production data: it writes ``status=live`` directly (the state machine
governs the real publish flow) and is namespaced behind a marker email so
``--clear`` can remove exactly what it created.

    manage.py seed_search_demo --listings 500
    manage.py seed_search_demo --clear
"""

from __future__ import annotations

import random

from django.contrib.gis.geos import Point
from django.core.management.base import BaseCommand
from django.db import transaction

from accounts.models import AccountLevel, User
from listings.enums import AssetClass, ListingStatus, ListingTier
from listings.models import Listing
from listings.spec_data import star_field
from suppliers.models import SupplierProfile, Yard

_MARKER = "search-demo"  # emails: search-demo-<n>@example.invalid

# (centre lng, centre lat) of the two seeded corridors.
_CORRIDORS = [(3.3650, 6.4400), (3.5000, 6.4450)]
_JITTER = 0.03  # ~3 km

# One representative asset type + plausible ★-spec range per class.
_CLASS_SPECS = {
    AssetClass.PLANT_MACHINERY: ("Excavator", "operating_weight", (5, 60)),
    AssetClass.TRUCKS_HAULAGE: ("Tipper / Dump Truck", "payload_capacity", (5, 40)),
    AssetClass.WAREHOUSING: ("Dry Warehouse", "floor_area", (200, 5000)),
    AssetClass.TERMINALS_YARDS: ("ICD", "container_capacity", (100, 3000)),
    AssetClass.LAND_STAGING: ("Laydown", "area", (500, 20000)),
}


class Command(BaseCommand):
    help = "Seed dual-corridor demo Live listings for search perf + the founder demo."

    def add_arguments(self, parser):
        parser.add_argument("--listings", type=int, default=500)
        parser.add_argument("--suppliers", type=int, default=12)
        parser.add_argument("--yards", type=int, default=24)
        parser.add_argument("--seed", type=int, default=42, help="RNG seed (reproducible).")
        parser.add_argument("--clear", action="store_true", help="Remove demo data and exit.")

    @transaction.atomic
    def handle(self, *args, **opts):
        if opts["clear"]:
            demo = {"supplier__email__startswith": f"{_MARKER}-"}
            # Delete in dependency order: the listing→yard FK is PROTECT, so
            # the listings must go before the yards (and users) they reference.
            Listing.objects.filter(**demo).delete()
            Yard.objects.filter(**demo).delete()
            count, _ = User.objects.filter(email__startswith=f"{_MARKER}-").delete()
            self.stdout.write(self.style.WARNING(f"Cleared demo data ({count} rows)."))
            return

        rng = random.Random(opts["seed"])
        suppliers = self._suppliers(opts["suppliers"])
        yards = self._yards(suppliers, opts["yards"], rng)
        self._listings(suppliers, yards, opts["listings"], rng)
        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded {opts['listings']} Live listings across {len(yards)} yards / "
                f"{len(suppliers)} suppliers in two corridors."
            )
        )

    def _suppliers(self, n: int) -> list[User]:
        suppliers = []
        for i in range(n):
            user, _ = User.objects.get_or_create(
                email=f"{_MARKER}-{i}@example.invalid",
                defaults={
                    "full_name": f"Demo Supplier {i}",
                    "phone": f"+23480{i:08d}",
                    "is_supplier": True,
                    "account_level": AccountLevel.VERIFIED,
                },
            )
            SupplierProfile.objects.get_or_create(
                user=user,
                defaults={
                    "business_name": f"Demo Plant & Haulage {i} Ltd",
                    "bank_name": "Demo Bank",
                    "bank_account_number_enc": "0123456789",
                    "bank_account_name": f"Demo Supplier {i}",
                },
            )
            suppliers.append(user)
        return suppliers

    def _yards(self, suppliers: list[User], n: int, rng: random.Random) -> list[Yard]:
        yards = []
        for i in range(n):
            clng, clat = _CORRIDORS[i % len(_CORRIDORS)]
            point = Point(
                clng + rng.uniform(-_JITTER, _JITTER),
                clat + rng.uniform(-_JITTER, _JITTER),
                srid=4326,
            )
            yards.append(
                Yard.objects.create(
                    supplier=rng.choice(suppliers),
                    name=f"Demo Yard {i}",
                    point=point,
                    city="Lagos",
                )
            )
        return yards

    def _listings(
        self, suppliers: list[User], yards: list[Yard], n: int, rng: random.Random
    ) -> None:
        classes = list(_CLASS_SPECS)
        batch = []
        for _ in range(n):
            asset_class = rng.choice(classes)
            asset_type, star, (lo, hi) = _CLASS_SPECS[asset_class]
            # 80% attach to a yard (→ yard pins), 20% solo with their own pin.
            if rng.random() < 0.8:
                yard = rng.choice(yards)
                supplier, point = yard.supplier, yard.point
            else:
                yard = None
                clng, clat = _CORRIDORS[rng.randrange(len(_CORRIDORS))]
                supplier = rng.choice(suppliers)
                point = Point(
                    clng + rng.uniform(-_JITTER, _JITTER),
                    clat + rng.uniform(-_JITTER, _JITTER),
                    srid=4326,
                )
            spec_field = star or star_field(str(asset_class))
            batch.append(
                Listing(
                    supplier=supplier,
                    yard=yard,
                    asset_class=asset_class,
                    asset_type=asset_type,
                    title=f"{asset_type} (demo)",
                    description="Seeded demo listing for the search performance pass. " * 2,
                    specs={spec_field: rng.randint(lo, hi)} if spec_field else {},
                    daily_price=rng.randrange(2_000_000, 30_000_000, 500_000),
                    point=point,
                    city="Lagos",
                    status=ListingStatus.LIVE,
                    tier=ListingTier.BASIC,
                )
            )
        Listing.objects.bulk_create(batch)
