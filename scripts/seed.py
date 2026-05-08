"""
Seed script for Terminal MVP internal testing.

Run with:
    python manage.py shell < scripts/seed.py

Creates:
    - 2 owner accounts
    - 2 renter accounts
    - 1 dual (owner+renter) account
    - 10 listings across all resource types
    - 3 booking requests
"""

import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()

from django.contrib.auth import get_user_model
from django.contrib.gis.geos import Point
from listings.models import Listing, ResourceType, ListingStatus

User = get_user_model()

print("Seeding Terminal MVP test data...")

# ── Users ──────────────────────────────────────────────────────────────────

owner1, _ = User.objects.get_or_create(
    email='owner1@test.com',
    defaults={
        'first_name': 'Emeka', 'last_name': 'Okafor',
        'phone': '08011111111', 'is_owner': True, 'is_renter': False,
        'is_email_verified': True, 'is_phone_verified': True,
    }
)
if _:
    owner1.set_password('test1234!')
    owner1.save()
    print(f"  Created owner: {owner1.email}")

owner2, _ = User.objects.get_or_create(
    email='owner2@test.com',
    defaults={
        'first_name': 'Ngozi', 'last_name': 'Adeleke',
        'phone': '08022222222', 'is_owner': True, 'is_renter': False,
        'is_email_verified': True, 'is_phone_verified': True,
    }
)
if _:
    owner2.set_password('test1234!')
    owner2.save()
    print(f"  Created owner: {owner2.email}")

renter1, _ = User.objects.get_or_create(
    email='renter1@test.com',
    defaults={
        'first_name': 'Tunde', 'last_name': 'Bello',
        'phone': '08033333333', 'is_owner': False, 'is_renter': True,
        'is_email_verified': True, 'is_phone_verified': True,
    }
)
if _:
    renter1.set_password('test1234!')
    renter1.save()
    print(f"  Created renter: {renter1.email}")

renter2, _ = User.objects.get_or_create(
    email='renter2@test.com',
    defaults={
        'first_name': 'Aisha', 'last_name': 'Musa',
        'phone': '08044444444', 'is_owner': False, 'is_renter': True,
        'is_email_verified': True, 'is_phone_verified': True,
    }
)
if _:
    renter2.set_password('test1234!')
    renter2.save()
    print(f"  Created renter: {renter2.email}")

dual, _ = User.objects.get_or_create(
    email='dual@test.com',
    defaults={
        'first_name': 'Chidi', 'last_name': 'Eze',
        'phone': '08055555555', 'is_owner': True, 'is_renter': True,
        'is_email_verified': True, 'is_phone_verified': True,
    }
)
if _:
    dual.set_password('test1234!')
    dual.save()
    print(f"  Created dual user: {dual.email}")

# ── Listings ──────────────────────────────────────────────────────────────

SEED_LISTINGS = [
    {
        'owner': owner1,
        'resource_type': ResourceType.EQUIPMENT,
        'title': '50T Liebherr Mobile Crane',
        'description': 'Well-maintained 50-tonne mobile crane available for short and long-term lease. Suitable for heavy construction and industrial lifting.',
        'category': 'Mobile Crane',
        'price_daily': 85000,
        'price_weekly': 500000,
        'price_monthly': 1800000,
        'specs': {'tonnage': 50, 'boom_length_m': 42, 'fuel_type': 'diesel'},
        'location': Point(3.3792, 6.5244, srid=4326),
        'location_address': '14 Marina Road, Lagos Island',
        'location_city': 'Lagos',
    },
    {
        'owner': owner1,
        'resource_type': ResourceType.EQUIPMENT,
        'title': 'Caterpillar 320 Excavator',
        'description': '20-tonne excavator in excellent condition. Hydraulic thumb available. Suitable for earthmoving, demolition, and foundation work.',
        'category': 'Excavator',
        'price_daily': 55000,
        'price_weekly': 320000,
        'price_monthly': 1100000,
        'specs': {'tonnage': 20, 'bucket_capacity_m3': 0.9, 'fuel_type': 'diesel'},
        'location': Point(3.3547, 6.4698, srid=4326),
        'location_address': '8 Wharf Road, Apapa, Lagos',
        'location_city': 'Lagos',
    },
    {
        'owner': owner2,
        'resource_type': ResourceType.VEHICLE,
        'title': '30T Flatbed Low-Loader Truck',
        'description': 'Heavy-duty low-loader flatbed truck for equipment transport. 30-tonne payload. Available with or without driver.',
        'category': 'Low-Loader Truck',
        'price_daily': 45000,
        'price_weekly': 260000,
        'price_monthly': 900000,
        'specs': {'payload_tonnes': 30, 'axles': 3, 'driver_available': True},
        'location': Point(3.3488, 6.4654, srid=4326),
        'location_address': 'Tin Can Island Port Road, Apapa',
        'location_city': 'Lagos',
    },
    {
        'owner': owner2,
        'resource_type': ResourceType.VEHICLE,
        'title': '20ft ISO Tipper Truck',
        'description': 'Heavy-duty tipper truck for construction aggregates and bulk material. Available for daily and weekly hire.',
        'category': 'Tipper Truck',
        'price_daily': 28000,
        'price_weekly': 160000,
        'specs': {'payload_tonnes': 15, 'body_type': 'rear_tipper'},
        'location': Point(3.3792, 6.4550, srid=4326),
        'location_address': 'Ozumba Mbadiwe Avenue, Victoria Island',
        'location_city': 'Lagos',
    },
    {
        'owner': owner1,
        'resource_type': ResourceType.WAREHOUSE,
        'title': 'Bonded Warehouse — Apapa (5,000 sqm)',
        'description': 'Customs-bonded dry goods warehouse near Apapa port. Security, CCTV, 3 loading bays. Ideal for importers.',
        'category': 'Bonded Warehouse',
        'price_monthly': 4500000,
        'specs': {'floor_area_sqm': 5000, 'height_clearance_m': 9, 'loading_bays': 3, 'temperature_controlled': False, 'bonded': True},
        'location': Point(3.3605, 6.4425, srid=4326),
        'location_address': 'Creek Road, Apapa, Lagos',
        'location_city': 'Lagos',
    },
    {
        'owner': owner2,
        'resource_type': ResourceType.WAREHOUSE,
        'title': 'Cold Storage Facility — Ikeja (1,200 sqm)',
        'description': 'Temperature-controlled cold storage. -18°C to +4°C range. Suitable for food, pharma, and perishables. 24/7 power backup.',
        'category': 'Cold Storage',
        'price_monthly': 3200000,
        'specs': {'floor_area_sqm': 1200, 'temperature_range': '-18 to +4°C', 'loading_bays': 2, 'power_backup': True},
        'location': Point(3.3436, 6.6018, srid=4326),
        'location_address': '45 Oba Akran Avenue, Ikeja',
        'location_city': 'Lagos',
    },
    {
        'owner': owner1,
        'resource_type': ResourceType.TERMINAL,
        'title': 'Container Depot — Tin Can Island (500 TEU)',
        'description': 'Inland container depot adjacent to Tin Can Island Port. RTG crane available. 24/7 access. Gate in/out tracking.',
        'category': 'Container Depot',
        'price_monthly': 12000000,
        'specs': {'capacity_teu': 500, 'crane_available': True, 'crane_type': 'RTG', 'shore_power': False},
        'location': Point(3.3159, 6.4478, srid=4326),
        'location_address': 'Tin Can Island Port, Apapa, Lagos',
        'location_city': 'Lagos',
    },
    {
        'owner': owner2,
        'resource_type': ResourceType.TERMINAL,
        'title': 'Open Container Yard — Ikorodu (200 TEU)',
        'description': 'Secured open container yard in Ikorodu. Suitable for staging, storage, and temporary container holding. Good road access.',
        'category': 'Container Yard',
        'price_monthly': 2800000,
        'specs': {'capacity_teu': 200, 'covered': False, 'security': '24hr guards + CCTV'},
        'location': Point(3.5000, 6.6194, srid=4326),
        'location_address': 'Lagos-Ikorodu Road, Ikorodu',
        'location_city': 'Lagos',
    },
    {
        'owner': dual,
        'resource_type': ResourceType.FACILITY,
        'title': 'Secured Equipment Yard — Ojota (2 acres)',
        'description': '2-acre secured compound for equipment parking and staging. Perimeter fencing, gate access control, and 24/7 security. Suitable for construction companies.',
        'category': 'Equipment Yard',
        'price_monthly': 1500000,
        'price_weekly': 420000,
        'specs': {'area_acres': 2, 'fenced': True, 'security': '24hr', 'hardstanding': True},
        'location': Point(3.3833, 6.5800, srid=4326),
        'location_address': '12 Lagos-Ibadan Expressway Service Road, Ojota',
        'location_city': 'Lagos',
    },
    {
        'owner': dual,
        'resource_type': ResourceType.EQUIPMENT,
        'title': 'Manitowoc 999 Crawler Crane — 300T',
        'description': '300-tonne Manitowoc crawler crane for heavy industrial lifts. Fully certified, operator available. Mobilisation costs apply for distances over 100km.',
        'category': 'Crawler Crane',
        'price_daily': 350000,
        'price_weekly': 2000000,
        'specs': {'tonnage': 300, 'type': 'crawler', 'boom_length_m': 90, 'operator_included': True},
        'location': Point(3.3669, 6.5833, srid=4326),
        'location_address': 'Oregun Industrial Estate, Ikeja',
        'location_city': 'Lagos',
    },
]

created_count = 0
for listing_data in SEED_LISTINGS:
    title = listing_data['title']
    if not Listing.objects.filter(title=title).exists():
        Listing.objects.create(
            **listing_data,
            status=ListingStatus.ACTIVE,
            is_available=True,
        )
        created_count += 1
        print(f"  Created listing: {title}")
    else:
        print(f"  Skipped (exists): {title}")

print("\nSeed complete.")
print("  Users created: 5 (owner1, owner2, renter1, renter2, dual)")
print(f"  Listings created: {created_count}")
print("\nTest credentials (all passwords: test1234!):")
print("  owner1@test.com  — Owner")
print("  owner2@test.com  — Owner")
print("  renter1@test.com — Renter")
print("  renter2@test.com — Renter")
print("  dual@test.com    — Owner + Renter")
print("  admin@terminal.app — Django Admin (password: admin1234!)")
