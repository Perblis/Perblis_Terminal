"""
Seed script for Terminal MVP internal testing.

Run with:
    python manage.py shell < scripts/seed.py

Creates:
    - 4 owner accounts (Lagos, Port Harcourt, Abuja, Kano)
    - 2 renter accounts
    - 1 dual (owner+renter) account
    - 50+ listings across all resource types and Nigerian cities
    - Owner profiles for all owners
"""

import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()

from django.contrib.auth import get_user_model
from django.contrib.gis.geos import Point
from listings.models import Listing, ResourceType, ListingStatus, VerificationTier

User = get_user_model()

print("Seeding Terminal MVP test data...")

# ── Users ──────────────────────────────────────────────────────────────────

owner1, _c = User.objects.get_or_create(
    email='owner1@test.com',
    defaults={
        'first_name': 'Emeka', 'last_name': 'Okafor',
        'phone': '08011111111', 'is_owner': True, 'is_renter': False,
        'is_email_verified': True, 'is_phone_verified': True,
    }
)
if _c:
    owner1.set_password('test1234!')
    owner1.save()
    print(f"  Created owner: {owner1.email}")

owner2, _c = User.objects.get_or_create(
    email='owner2@test.com',
    defaults={
        'first_name': 'Ngozi', 'last_name': 'Adeleke',
        'phone': '08022222222', 'is_owner': True, 'is_renter': False,
        'is_email_verified': True, 'is_phone_verified': True,
    }
)
if _c:
    owner2.set_password('test1234!')
    owner2.save()
    print(f"  Created owner: {owner2.email}")

owner3, _c = User.objects.get_or_create(
    email='owner3@test.com',
    defaults={
        'first_name': 'Babatunde', 'last_name': 'Fashola',
        'phone': '08066666666', 'is_owner': True, 'is_renter': False,
        'is_email_verified': True, 'is_phone_verified': True,
    }
)
if _c:
    owner3.set_password('test1234!')
    owner3.save()
    print(f"  Created owner: {owner3.email}")

owner4, _c = User.objects.get_or_create(
    email='owner4@test.com',
    defaults={
        'first_name': 'Hauwa', 'last_name': 'Ibrahim',
        'phone': '08077777777', 'is_owner': True, 'is_renter': False,
        'is_email_verified': True, 'is_phone_verified': True,
    }
)
if _c:
    owner4.set_password('test1234!')
    owner4.save()
    print(f"  Created owner: {owner4.email}")

renter1, _c = User.objects.get_or_create(
    email='renter1@test.com',
    defaults={
        'first_name': 'Tunde', 'last_name': 'Bello',
        'phone': '08033333333', 'is_owner': False, 'is_renter': True,
        'is_email_verified': True, 'is_phone_verified': True,
    }
)
if _c:
    renter1.set_password('test1234!')
    renter1.save()
    print(f"  Created renter: {renter1.email}")

renter2, _c = User.objects.get_or_create(
    email='renter2@test.com',
    defaults={
        'first_name': 'Aisha', 'last_name': 'Musa',
        'phone': '08044444444', 'is_owner': False, 'is_renter': True,
        'is_email_verified': True, 'is_phone_verified': True,
    }
)
if _c:
    renter2.set_password('test1234!')
    renter2.save()
    print(f"  Created renter: {renter2.email}")

dual, _c = User.objects.get_or_create(
    email='dual@test.com',
    defaults={
        'first_name': 'Chidi', 'last_name': 'Eze',
        'phone': '08055555555', 'is_owner': True, 'is_renter': True,
        'is_email_verified': True, 'is_phone_verified': True,
    }
)
if _c:
    dual.set_password('test1234!')
    dual.save()
    print(f"  Created dual user: {dual.email}")

# ── Listings ──────────────────────────────────────────────────────────────

SEED_LISTINGS = [

    # ── LAGOS — Equipment ──────────────────────────────────────────────────
    {
        'owner': owner1,
        'resource_type': ResourceType.EQUIPMENT,
        'title': '50T Liebherr Mobile Crane',
        'description': 'Well-maintained 50-tonne mobile crane available for short and long-term lease. Suitable for heavy construction and industrial lifting.',
        'category': 'Mobile Crane',
        'price_daily': 85000,
        'price_weekly': 500000,
        'price_monthly': 1800000,
        'specs': {'tonnage': 50, 'boom_length_m': 42, 'fuel_type': 'diesel', 'year': 2018},
        'location': Point(3.3792, 6.5244, srid=4326),
        'location_address': '14 Marina Road, Lagos Island',
        'location_city': 'Lagos',
        'operator_available': True,
        'verification_tier': VerificationTier.INSPECTED,
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
        'specs': {'tonnage': 20, 'bucket_capacity_m3': 0.9, 'fuel_type': 'diesel', 'year': 2019},
        'location': Point(3.3547, 6.4698, srid=4326),
        'location_address': '8 Wharf Road, Apapa, Lagos',
        'location_city': 'Lagos',
        'operator_available': True,
        'verification_tier': VerificationTier.VERIFIED,
    },
    {
        'owner': dual,
        'resource_type': ResourceType.EQUIPMENT,
        'title': 'Manitowoc 999 Crawler Crane — 300T',
        'description': '300-tonne Manitowoc crawler crane for heavy industrial lifts. Fully certified, operator available. Mobilisation costs apply for distances over 100km.',
        'category': 'Crawler Crane',
        'price_daily': 350000,
        'price_weekly': 2000000,
        'specs': {'tonnage': 300, 'type': 'crawler', 'boom_length_m': 90, 'year': 2016},
        'location': Point(3.3669, 6.5833, srid=4326),
        'location_address': 'Oregun Industrial Estate, Ikeja, Lagos',
        'location_city': 'Lagos',
        'operator_available': True,
        'verification_tier': VerificationTier.INSPECTED,
    },
    {
        'owner': owner1,
        'resource_type': ResourceType.EQUIPMENT,
        'title': 'Grove GMK 3060 All-Terrain Crane — 60T',
        'description': '60-tonne all-terrain crane. 5-axle carrier, suitable for confined site access. Certified for offshore and onshore operations.',
        'category': 'All-Terrain Crane',
        'price_daily': 110000,
        'price_weekly': 650000,
        'price_monthly': 2300000,
        'specs': {'tonnage': 60, 'boom_length_m': 48, 'axles': 5, 'year': 2020},
        'location': Point(3.3615, 6.4500, srid=4326),
        'location_address': 'Creek Road, Apapa, Lagos',
        'location_city': 'Lagos',
        'operator_available': True,
        'verification_tier': VerificationTier.INSPECTED,
    },
    {
        'owner': owner2,
        'resource_type': ResourceType.EQUIPMENT,
        'title': 'Komatsu PC210 Excavator',
        'description': '21-tonne Komatsu excavator with rock bucket. Ideal for quarry, road construction, and drainage works. Well-serviced.',
        'category': 'Excavator',
        'price_daily': 58000,
        'price_weekly': 330000,
        'price_monthly': 1150000,
        'specs': {'tonnage': 21, 'bucket_capacity_m3': 1.0, 'fuel_type': 'diesel', 'year': 2017},
        'location': Point(3.3900, 6.5100, srid=4326),
        'location_address': 'Isale Eko, Lagos Island',
        'location_city': 'Lagos',
        'operator_available': False,
        'verification_tier': VerificationTier.VERIFIED,
    },
    {
        'owner': owner2,
        'resource_type': ResourceType.EQUIPMENT,
        'title': 'JCB 3CX Backhoe Loader',
        'description': 'Versatile backhoe loader for utility trenching, small excavations, and material handling. Available with bucket and breaker attachments.',
        'category': 'Backhoe Loader',
        'price_daily': 32000,
        'price_weekly': 185000,
        'price_monthly': 650000,
        'specs': {'digging_depth_m': 5.5, 'loader_capacity_m3': 1.0, 'year': 2021},
        'location': Point(3.4200, 6.5500, srid=4326),
        'location_address': 'Oshodi, Lagos',
        'location_city': 'Lagos',
        'operator_available': False,
        'delivery_available': True,
        'verification_tier': VerificationTier.BASIC,
    },
    {
        'owner': dual,
        'resource_type': ResourceType.EQUIPMENT,
        'title': 'Terex Rough Terrain Crane — 35T',
        'description': '35-tonne rough-terrain crane for off-road sites. Single-axle carrier, compact and manoeuvrable. Available with experienced operator.',
        'category': 'Rough Terrain Crane',
        'price_daily': 65000,
        'price_weekly': 380000,
        'specs': {'tonnage': 35, 'boom_length_m': 30, 'drive': '4WD', 'year': 2018},
        'location': Point(3.3833, 6.5800, srid=4326),
        'location_address': 'Ojota, Lagos',
        'location_city': 'Lagos',
        'operator_available': True,
        'verification_tier': VerificationTier.VERIFIED,
    },
    {
        'owner': owner1,
        'resource_type': ResourceType.EQUIPMENT,
        'title': 'Concrete Pump Truck — 42m Boom',
        'description': 'Schwing 42-metre boom concrete pump for high-rise and large slab pours. Minimum 50m³ per booking. Pump crew included.',
        'category': 'Concrete Pump',
        'price_daily': 120000,
        'price_weekly': 700000,
        'specs': {'boom_reach_m': 42, 'output_m3_hr': 90, 'crew_included': True, 'year': 2019},
        'location': Point(3.3792, 6.5244, srid=4326),
        'location_address': 'Marina Road, Lagos Island',
        'location_city': 'Lagos',
        'operator_available': True,
        'delivery_available': True,
        'verification_tier': VerificationTier.VERIFIED,
    },

    # ── LAGOS — Vehicles ───────────────────────────────────────────────────
    {
        'owner': owner2,
        'resource_type': ResourceType.VEHICLE,
        'title': '30T Flatbed Low-Loader Truck',
        'description': 'Heavy-duty low-loader flatbed truck for equipment transport. 30-tonne payload. Available with or without driver.',
        'category': 'Low-Loader Truck',
        'price_daily': 45000,
        'price_weekly': 260000,
        'price_monthly': 900000,
        'specs': {'payload_tonnes': 30, 'axles': 3, 'year': 2019},
        'location': Point(3.3488, 6.4654, srid=4326),
        'location_address': 'Tin Can Island Port Road, Apapa, Lagos',
        'location_city': 'Lagos',
        'delivery_available': True,
        'verification_tier': VerificationTier.VERIFIED,
    },
    {
        'owner': owner2,
        'resource_type': ResourceType.VEHICLE,
        'title': '20ft ISO Tipper Truck',
        'description': 'Heavy-duty tipper truck for construction aggregates and bulk material. Available for daily and weekly hire.',
        'category': 'Tipper Truck',
        'price_daily': 28000,
        'price_weekly': 160000,
        'specs': {'payload_tonnes': 15, 'body_type': 'rear_tipper', 'year': 2020},
        'location': Point(3.3792, 6.4550, srid=4326),
        'location_address': 'Ozumba Mbadiwe Avenue, Victoria Island, Lagos',
        'location_city': 'Lagos',
        'delivery_available': True,
        'verification_tier': VerificationTier.BASIC,
    },
    {
        'owner': owner1,
        'resource_type': ResourceType.VEHICLE,
        'title': '40ft Articulated Trailer Truck',
        'description': 'Long-haul 40ft articulated truck for cargo and container haulage. Experienced driver included. Available for Lagos and upcountry routes.',
        'category': 'Articulated Truck',
        'price_daily': 60000,
        'price_weekly': 350000,
        'specs': {'payload_tonnes': 25, 'trailer_length_ft': 40, 'year': 2018},
        'location': Point(3.3547, 6.4698, srid=4326),
        'location_address': 'Apapa Wharf Road, Lagos',
        'location_city': 'Lagos',
        'delivery_available': True,
        'verification_tier': VerificationTier.VERIFIED,
    },
    {
        'owner': owner2,
        'resource_type': ResourceType.VEHICLE,
        'title': 'Mack Granite Mixer Truck — 9m³',
        'description': '9-cubic-metre ready-mix concrete truck. Available for construction sites in Lagos metropolis. Chute extension available.',
        'category': 'Concrete Mixer Truck',
        'price_daily': 38000,
        'price_weekly': 220000,
        'specs': {'drum_capacity_m3': 9, 'year': 2017, 'fuel_type': 'diesel'},
        'location': Point(3.3900, 6.5200, srid=4326),
        'location_address': 'Ikorodu Road, Lagos',
        'location_city': 'Lagos',
        'delivery_available': True,
        'verification_tier': VerificationTier.BASIC,
    },
    {
        'owner': dual,
        'resource_type': ResourceType.VEHICLE,
        'title': 'Crane Truck — 10T Knuckle Boom',
        'description': '10-tonne knuckle boom crane truck for self-loading and delivery of heavy cargo. Ideal for steel, machinery, and equipment delivery.',
        'category': 'Crane Truck',
        'price_daily': 42000,
        'price_weekly': 240000,
        'specs': {'lift_capacity_tonnes': 10, 'reach_m': 12, 'year': 2019},
        'location': Point(3.3669, 6.5833, srid=4326),
        'location_address': 'Oregun Industrial Estate, Ikeja, Lagos',
        'location_city': 'Lagos',
        'delivery_available': True,
        'operator_available': True,
        'verification_tier': VerificationTier.VERIFIED,
    },

    # ── LAGOS — Warehouses ────────────────────────────────────────────────
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
        'verification_tier': VerificationTier.VERIFIED,
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
        'location_address': '45 Oba Akran Avenue, Ikeja, Lagos',
        'location_city': 'Lagos',
        'verification_tier': VerificationTier.INSPECTED,
    },
    {
        'owner': owner1,
        'resource_type': ResourceType.WAREHOUSE,
        'title': 'General Purpose Warehouse — Isolo (2,500 sqm)',
        'description': 'Dry goods warehouse in Isolo industrial area. Drive-in access for 40ft containers. 2 docks. Forklift available.',
        'category': 'General Warehouse',
        'price_monthly': 2200000,
        'price_weekly': 600000,
        'specs': {'floor_area_sqm': 2500, 'height_clearance_m': 7, 'loading_bays': 2, 'forklift_available': True},
        'location': Point(3.3167, 6.5333, srid=4326),
        'location_address': 'Isolo Industrial Area, Lagos',
        'location_city': 'Lagos',
        'verification_tier': VerificationTier.BASIC,
    },
    {
        'owner': owner2,
        'resource_type': ResourceType.WAREHOUSE,
        'title': 'Pharma Warehouse — Ikeja GRA (800 sqm)',
        'description': 'GDP-compliant pharmaceutical warehouse. Humidity-controlled, CCTV, restricted access. Suitable for drug and medical device storage.',
        'category': 'Pharmaceutical Warehouse',
        'price_monthly': 2800000,
        'specs': {'floor_area_sqm': 800, 'gdp_compliant': True, 'humidity_controlled': True, 'temperature_range': '+15 to +25°C'},
        'location': Point(3.3500, 6.5900, srid=4326),
        'location_address': 'Ikeja GRA, Lagos',
        'location_city': 'Lagos',
        'verification_tier': VerificationTier.INSPECTED,
    },

    # ── LAGOS — Terminals ─────────────────────────────────────────────────
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
        'verification_tier': VerificationTier.VERIFIED,
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
        'location_address': 'Lagos-Ikorodu Road, Ikorodu, Lagos',
        'location_city': 'Lagos',
        'verification_tier': VerificationTier.BASIC,
    },
    {
        'owner': dual,
        'resource_type': ResourceType.TERMINAL,
        'title': 'RoRo Marshalling Yard — Apapa (300 slots)',
        'description': 'Roll-on/roll-off vehicle marshalling yard adjacent to Apapa Port. 300-vehicle capacity. Suitable for vehicle import/export staging.',
        'category': 'RoRo Yard',
        'price_monthly': 5500000,
        'specs': {'vehicle_slots': 300, 'surface': 'concrete', 'security': '24hr', 'port_access': 'direct'},
        'location': Point(3.3700, 6.4550, srid=4326),
        'location_address': 'Apapa Port Complex, Lagos',
        'location_city': 'Lagos',
        'verification_tier': VerificationTier.VERIFIED,
    },

    # ── LAGOS — Facilities ────────────────────────────────────────────────
    {
        'owner': dual,
        'resource_type': ResourceType.FACILITY,
        'title': 'Secured Equipment Yard — Ojota (2 acres)',
        'description': '2-acre secured compound for equipment parking and staging. Perimeter fencing, gate access control, and 24/7 security.',
        'category': 'Equipment Yard',
        'price_monthly': 1500000,
        'price_weekly': 420000,
        'specs': {'area_acres': 2, 'fenced': True, 'security': '24hr', 'hardstanding': True},
        'location': Point(3.3833, 6.5800, srid=4326),
        'location_address': '12 Lagos-Ibadan Expressway Service Road, Ojota, Lagos',
        'location_city': 'Lagos',
        'verification_tier': VerificationTier.BASIC,
    },
    {
        'owner': owner1,
        'resource_type': ResourceType.FACILITY,
        'title': 'Workshop & Maintenance Bay — Apapa (1,500 sqm)',
        'description': 'Heavy equipment maintenance workshop with 10-tonne overhead crane, lubrication bay, and 4 inspection pits. Suitable for equipment servicing and repair.',
        'category': 'Maintenance Workshop',
        'price_monthly': 2500000,
        'price_weekly': 700000,
        'specs': {'area_sqm': 1500, 'overhead_crane_t': 10, 'inspection_pits': 4, 'lubrication_bay': True},
        'location': Point(3.3600, 6.4500, srid=4326),
        'location_address': 'Apapa Industrial Area, Lagos',
        'location_city': 'Lagos',
        'verification_tier': VerificationTier.VERIFIED,
    },
    {
        'owner': owner2,
        'resource_type': ResourceType.FACILITY,
        'title': 'Logistics Hub — Lekki Free Zone (5 acres)',
        'description': '5-acre logistics staging area in Lekki Free Zone. Hardstanding concrete, perimeter fence, 24/7 power, and fibre internet.',
        'category': 'Logistics Hub',
        'price_monthly': 6000000,
        'specs': {'area_acres': 5, 'hardstanding': 'concrete', 'power': '24/7', 'internet': 'fibre'},
        'location': Point(3.7893, 6.4467, srid=4326),
        'location_address': 'Lekki Free Zone, Epe Expressway, Lagos',
        'location_city': 'Lagos',
        'verification_tier': VerificationTier.INSPECTED,
    },

    # ── PORT HARCOURT ──────────────────────────────────────────────────────
    {
        'owner': owner3,
        'resource_type': ResourceType.EQUIPMENT,
        'title': 'Liebherr LTM 1100 Mobile Crane — 100T',
        'description': '100-tonne mobile crane for heavy industrial and offshore support lifts. Based in Port Harcourt. Fully certified for oil & gas sector.',
        'category': 'Mobile Crane',
        'price_daily': 150000,
        'price_weekly': 900000,
        'price_monthly': 3200000,
        'specs': {'tonnage': 100, 'boom_length_m': 60, 'fuel_type': 'diesel', 'oil_gas_certified': True, 'year': 2019},
        'location': Point(7.0134, 4.8156, srid=4326),
        'location_address': 'Trans Amadi Industrial Layout, Port Harcourt',
        'location_city': 'Port Harcourt',
        'operator_available': True,
        'verification_tier': VerificationTier.INSPECTED,
    },
    {
        'owner': owner3,
        'resource_type': ResourceType.EQUIPMENT,
        'title': 'Liebherr LTM 1500 Mobile Crane — 500T',
        'description': '500-tonne lattice boom crane for major heavy lifts in the Niger Delta. Mobilisation within Port Harcourt/Rivers State included. Operator and rigger team available.',
        'category': 'Mobile Crane',
        'price_daily': 650000,
        'price_weekly': 3800000,
        'specs': {'tonnage': 500, 'boom_length_m': 120, 'oil_gas_certified': True, 'crew_included': True, 'year': 2015},
        'location': Point(7.0200, 4.8300, srid=4326),
        'location_address': 'Rumuola Road, Port Harcourt',
        'location_city': 'Port Harcourt',
        'operator_available': True,
        'verification_tier': VerificationTier.INSPECTED,
    },
    {
        'owner': owner3,
        'resource_type': ResourceType.EQUIPMENT,
        'title': 'Telescopic Reach Stacker — 45T',
        'description': '45-tonne reach stacker for container terminal and heavy yard operations. Available for short and long-term lease in Port Harcourt.',
        'category': 'Reach Stacker',
        'price_daily': 90000,
        'price_weekly': 530000,
        'price_monthly': 1900000,
        'specs': {'lift_capacity_tonnes': 45, 'lift_height_m': 14, 'year': 2020},
        'location': Point(6.9900, 4.8000, srid=4326),
        'location_address': 'Onne Oil and Gas Free Zone, Port Harcourt',
        'location_city': 'Port Harcourt',
        'operator_available': True,
        'verification_tier': VerificationTier.VERIFIED,
    },
    {
        'owner': owner3,
        'resource_type': ResourceType.VEHICLE,
        'title': 'HIAB Crane Truck — 20T (Port Harcourt)',
        'description': '20-tonne HIAB crane truck for heavy goods delivery and field installation. Knuckle boom with remote control. Available for PH and Rivers State.',
        'category': 'Crane Truck',
        'price_daily': 55000,
        'price_weekly': 320000,
        'specs': {'lift_capacity_tonnes': 20, 'reach_m': 15, 'year': 2018},
        'location': Point(7.0134, 4.8156, srid=4326),
        'location_address': 'Trans Amadi Industrial Layout, Port Harcourt',
        'location_city': 'Port Harcourt',
        'delivery_available': True,
        'operator_available': True,
        'verification_tier': VerificationTier.VERIFIED,
    },
    {
        'owner': owner3,
        'resource_type': ResourceType.WAREHOUSE,
        'title': 'Oil & Gas Bonded Store — Onne (3,000 sqm)',
        'description': 'Customs-bonded warehouse in Onne Oil & Gas Free Zone. Suitable for oilfield equipment, chemicals, and general cargo. 24/7 access.',
        'category': 'Bonded Warehouse',
        'price_monthly': 5800000,
        'specs': {'floor_area_sqm': 3000, 'bonded': True, 'hazmat_approved': True, 'loading_bays': 4, 'height_clearance_m': 10},
        'location': Point(7.1500, 4.7200, srid=4326),
        'location_address': 'Onne Oil & Gas Free Zone, Rivers State',
        'location_city': 'Port Harcourt',
        'verification_tier': VerificationTier.INSPECTED,
    },
    {
        'owner': owner3,
        'resource_type': ResourceType.TERMINAL,
        'title': 'Container Terminal Berth — Port Harcourt (1,000 TEU)',
        'description': 'Private container terminal berth at Onne Port Complex. 1,000 TEU stacking capacity. Shore cranes, reefer plugs, and 24/7 gate.',
        'category': 'Container Terminal',
        'price_monthly': 22000000,
        'specs': {'capacity_teu': 1000, 'reefer_plugs': 50, 'crane_type': 'ship-to-shore', 'shore_power': True},
        'location': Point(7.1600, 4.7100, srid=4326),
        'location_address': 'Onne Port Complex, Rivers State',
        'location_city': 'Port Harcourt',
        'verification_tier': VerificationTier.VERIFIED,
    },
    {
        'owner': owner3,
        'resource_type': ResourceType.FACILITY,
        'title': 'Oilfield Equipment Yard — Trans Amadi (3 acres)',
        'description': '3-acre hardstanding yard for oilfield equipment staging and storage. Perimeter wall, CCTV, 24/7 security. Adjacent to Trans Amadi Industrial Layout.',
        'category': 'Equipment Yard',
        'price_monthly': 3500000,
        'specs': {'area_acres': 3, 'hardstanding': 'concrete', 'security': '24hr CCTV', 'crane_hire_available': True},
        'location': Point(7.0050, 4.8200, srid=4326),
        'location_address': 'Trans Amadi, Port Harcourt',
        'location_city': 'Port Harcourt',
        'verification_tier': VerificationTier.VERIFIED,
    },

    # ── ABUJA ──────────────────────────────────────────────────────────────
    {
        'owner': owner4,
        'resource_type': ResourceType.EQUIPMENT,
        'title': 'Tadano ATF 130G All-Terrain Crane — 130T',
        'description': '130-tonne all-terrain crane for infrastructure and building projects in Abuja. FCT and North Central deployments available.',
        'category': 'All-Terrain Crane',
        'price_daily': 180000,
        'price_weekly': 1050000,
        'price_monthly': 3800000,
        'specs': {'tonnage': 130, 'boom_length_m': 68, 'axles': 6, 'year': 2021},
        'location': Point(7.4898, 9.0579, srid=4326),
        'location_address': 'Idu Industrial Area, Abuja',
        'location_city': 'Abuja',
        'operator_available': True,
        'verification_tier': VerificationTier.INSPECTED,
    },
    {
        'owner': owner4,
        'resource_type': ResourceType.EQUIPMENT,
        'title': 'Volvo EC250 Excavator — Abuja',
        'description': '25-tonne Volvo excavator for road construction, drainage, and civil works in Abuja and FCT. Operator available.',
        'category': 'Excavator',
        'price_daily': 62000,
        'price_weekly': 360000,
        'price_monthly': 1250000,
        'specs': {'tonnage': 25, 'bucket_capacity_m3': 1.1, 'fuel_type': 'diesel', 'year': 2020},
        'location': Point(7.5000, 9.0700, srid=4326),
        'location_address': 'Idu Industrial Area, Abuja',
        'location_city': 'Abuja',
        'operator_available': True,
        'verification_tier': VerificationTier.VERIFIED,
    },
    {
        'owner': owner4,
        'resource_type': ResourceType.EQUIPMENT,
        'title': 'Motor Grader — Caterpillar 140M',
        'description': 'Cat 140M motor grader for road levelling, grading, and earthworks. Ripper and blade scarifier available.',
        'category': 'Motor Grader',
        'price_daily': 70000,
        'price_weekly': 410000,
        'price_monthly': 1450000,
        'specs': {'blade_width_m': 3.7, 'engine_hp': 145, 'year': 2018},
        'location': Point(7.4800, 9.0500, srid=4326),
        'location_address': 'Kubwa Industrial Area, Abuja',
        'location_city': 'Abuja',
        'operator_available': True,
        'verification_tier': VerificationTier.BASIC,
    },
    {
        'owner': owner4,
        'resource_type': ResourceType.VEHICLE,
        'title': 'Low-Loader Truck — 50T (Abuja)',
        'description': '50-tonne heavy equipment transporter based in Abuja. Available for FCT and intercity equipment mobilisation. FAAN-certified.',
        'category': 'Low-Loader Truck',
        'price_daily': 65000,
        'price_weekly': 380000,
        'specs': {'payload_tonnes': 50, 'axles': 4, 'year': 2017},
        'location': Point(7.4898, 9.0579, srid=4326),
        'location_address': 'Idu Industrial Area, Abuja',
        'location_city': 'Abuja',
        'delivery_available': True,
        'verification_tier': VerificationTier.VERIFIED,
    },
    {
        'owner': owner4,
        'resource_type': ResourceType.WAREHOUSE,
        'title': 'Distribution Warehouse — Jabi (2,000 sqm)',
        'description': 'Modern distribution warehouse near Jabi Lake. Suitable for FMCG, construction materials, and general cargo. Ramp access for trucks.',
        'category': 'Distribution Warehouse',
        'price_monthly': 2600000,
        'specs': {'floor_area_sqm': 2000, 'height_clearance_m': 8, 'loading_bays': 3, 'ramp_access': True},
        'location': Point(7.4274, 9.0764, srid=4326),
        'location_address': 'Jabi District, Abuja',
        'location_city': 'Abuja',
        'verification_tier': VerificationTier.BASIC,
    },
    {
        'owner': owner4,
        'resource_type': ResourceType.FACILITY,
        'title': 'Construction Camp — Karu (10 acres)',
        'description': '10-acre construction camp with offices, workshops, accommodation modules, and equipment yard. Ideal for large infrastructure project base camps.',
        'category': 'Construction Camp',
        'price_monthly': 8000000,
        'specs': {'area_acres': 10, 'accommodation_modules': 20, 'workshop_sqm': 800, 'power': '24/7 generator'},
        'location': Point(7.5500, 9.0300, srid=4326),
        'location_address': 'Karu Satellite Town, Abuja',
        'location_city': 'Abuja',
        'verification_tier': VerificationTier.VERIFIED,
    },

    # ── KANO ───────────────────────────────────────────────────────────────
    {
        'owner': owner4,
        'resource_type': ResourceType.EQUIPMENT,
        'title': 'Kobelco CKE2500 Crawler Crane — 250T (Kano)',
        'description': '250-tonne crawler crane for refinery, cement plant, and heavy industry projects in Kano and Northwest Nigeria.',
        'category': 'Crawler Crane',
        'price_daily': 420000,
        'price_weekly': 2400000,
        'specs': {'tonnage': 250, 'boom_length_m': 84, 'type': 'crawler', 'year': 2016},
        'location': Point(8.5167, 12.0022, srid=4326),
        'location_address': 'Sharada Industrial Estate, Kano',
        'location_city': 'Kano',
        'operator_available': True,
        'verification_tier': VerificationTier.VERIFIED,
    },
    {
        'owner': owner4,
        'resource_type': ResourceType.EQUIPMENT,
        'title': 'Articulated Dump Truck — 40T (Kano)',
        'description': '40-tonne articulated dump truck for mining, quarry, and bulk earthworks. Available for Kano and surrounding northern states.',
        'category': 'Dump Truck',
        'price_daily': 78000,
        'price_weekly': 455000,
        'price_monthly': 1600000,
        'specs': {'payload_tonnes': 40, 'type': 'articulated', 'drive': '6x6', 'year': 2018},
        'location': Point(8.5300, 12.0100, srid=4326),
        'location_address': 'Challawa Industrial Area, Kano',
        'location_city': 'Kano',
        'operator_available': False,
        'verification_tier': VerificationTier.BASIC,
    },
    {
        'owner': owner4,
        'resource_type': ResourceType.WAREHOUSE,
        'title': 'Grain Warehouse — Dawanau (10,000 sqm)',
        'description': 'Large-capacity grain storage warehouse near Dawanau Market. Suitable for cereals, legumes, and agro-commodities. Loading dock for articulated trucks.',
        'category': 'Agro Warehouse',
        'price_monthly': 3800000,
        'specs': {'floor_area_sqm': 10000, 'height_clearance_m': 12, 'loading_bays': 6, 'grain_approved': True},
        'location': Point(8.4700, 12.1000, srid=4326),
        'location_address': 'Dawanau Grain Market Area, Kano',
        'location_city': 'Kano',
        'verification_tier': VerificationTier.BASIC,
    },
    {
        'owner': owner4,
        'resource_type': ResourceType.TERMINAL,
        'title': 'Dry Port — Kano (600 TEU)',
        'description': 'Inland dry port and container depot at Kano. NRC rail siding access. 600 TEU stacking capacity. Suitable for Northern trade corridor.',
        'category': 'Dry Port',
        'price_monthly': 9000000,
        'specs': {'capacity_teu': 600, 'rail_access': True, 'reefer_plugs': 20, 'customs_bonded': True},
        'location': Point(8.5167, 12.0022, srid=4326),
        'location_address': 'Kano Inland Dry Port, Challawa, Kano',
        'location_city': 'Kano',
        'verification_tier': VerificationTier.VERIFIED,
    },

    # ── IBADAN ─────────────────────────────────────────────────────────────
    {
        'owner': owner3,
        'resource_type': ResourceType.EQUIPMENT,
        'title': 'Potain Tower Crane — 8T (Ibadan)',
        'description': '8-tonne flat-top tower crane for high-rise construction in Ibadan. Free-standing up to 40m. Foundation design available.',
        'category': 'Tower Crane',
        'price_monthly': 1800000,
        'price_weekly': 520000,
        'specs': {'max_load_t': 8, 'jib_length_m': 50, 'free_standing_height_m': 40, 'year': 2017},
        'location': Point(3.9000, 7.3775, srid=4326),
        'location_address': 'Ring Road, Ibadan',
        'location_city': 'Ibadan',
        'operator_available': True,
        'verification_tier': VerificationTier.VERIFIED,
    },
    {
        'owner': owner3,
        'resource_type': ResourceType.EQUIPMENT,
        'title': 'Compactor Roller — Dynapac CA300 (Ibadan)',
        'description': '11-tonne vibratory single-drum compactor for road base and subgrade compaction. Available in Ibadan and Oyo State.',
        'category': 'Compactor',
        'price_daily': 28000,
        'price_weekly': 162000,
        'price_monthly': 570000,
        'specs': {'operating_weight_t': 11, 'drum_width_m': 2.13, 'frequency_hz': 28, 'year': 2019},
        'location': Point(3.9200, 7.3900, srid=4326),
        'location_address': 'Oluyole Industrial Estate, Ibadan',
        'location_city': 'Ibadan',
        'operator_available': False,
        'delivery_available': True,
        'verification_tier': VerificationTier.BASIC,
    },
    {
        'owner': owner3,
        'resource_type': ResourceType.WAREHOUSE,
        'title': 'Transit Warehouse — Ojoo (4,000 sqm)',
        'description': 'Transit warehouse on Lagos-Ibadan Expressway corridor. High clearance, loading docks, and ample truck parking. Ideal for logistics operators.',
        'category': 'Transit Warehouse',
        'price_monthly': 2400000,
        'specs': {'floor_area_sqm': 4000, 'height_clearance_m': 9, 'loading_bays': 4, 'truck_parking': 20},
        'location': Point(3.8833, 7.4500, srid=4326),
        'location_address': 'Ojoo Bus Stop, Lagos-Ibadan Expressway, Ibadan',
        'location_city': 'Ibadan',
        'verification_tier': VerificationTier.VERIFIED,
    },

    # ── WARRI ──────────────────────────────────────────────────────────────
    {
        'owner': owner3,
        'resource_type': ResourceType.EQUIPMENT,
        'title': 'Offshore Supply Vessel Crane — 25T (Warri)',
        'description': '25-tonne pedestal crane for offshore platform and vessel operations. OPITO-certified operator available. Based in Warri/Delta State.',
        'category': 'Offshore Crane',
        'price_daily': 200000,
        'price_weekly': 1150000,
        'specs': {'lift_capacity_tonnes': 25, 'boom_length_m': 20, 'opito_certified': True, 'year': 2014},
        'location': Point(5.7500, 5.5167, srid=4326),
        'location_address': 'Effurun Industrial Area, Warri, Delta State',
        'location_city': 'Warri',
        'operator_available': True,
        'verification_tier': VerificationTier.INSPECTED,
    },
    {
        'owner': owner3,
        'resource_type': ResourceType.VEHICLE,
        'title': 'Vacuum Tanker Truck — 15,000L (Warri)',
        'description': '15,000-litre vacuum tanker for industrial waste, drill cuttings, and sludge removal. HSE-certified. Available for Warri and Niger Delta.',
        'category': 'Vacuum Tanker',
        'price_daily': 72000,
        'price_weekly': 420000,
        'specs': {'tank_capacity_litres': 15000, 'hse_certified': True, 'pump_type': 'positive displacement', 'year': 2018},
        'location': Point(5.7600, 5.5200, srid=4326),
        'location_address': 'DSC Road, Warri, Delta State',
        'location_city': 'Warri',
        'delivery_available': True,
        'verification_tier': VerificationTier.VERIFIED,
    },
    {
        'owner': owner3,
        'resource_type': ResourceType.FACILITY,
        'title': 'Fabrication Yard — Warri (4 acres)',
        'description': '4-acre fabrication yard with overhead gantry crane (20T), welding stations, and sandblasting booth. Available for structural and pipeline fabrication.',
        'category': 'Fabrication Yard',
        'price_monthly': 4800000,
        'specs': {'area_acres': 4, 'gantry_crane_t': 20, 'welding_stations': 12, 'sandblasting': True},
        'location': Point(5.7450, 5.5100, srid=4326),
        'location_address': 'Warri Industrial Area, Delta State',
        'location_city': 'Warri',
        'verification_tier': VerificationTier.INSPECTED,
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

# ── Owner Profiles ─────────────────────────────────────────────────────────

from accounts.models import OwnerProfile

OWNER_PROFILES = {
    owner1: {
        'business_name': 'Okafor Heavy Equipment Ltd',
        'business_description': 'Lagos-based crane and excavator fleet operator with 15 years experience.',
        'bank_name': 'First Bank',
        'bank_account_number': '3012345678',
        'bank_account_name': 'OKAFOR HEAVY EQUIPMENT LTD',
    },
    owner2: {
        'business_name': 'Adeleke Logistics & Storage',
        'business_description': 'Warehouse and transport solutions across Lagos and Port Harcourt.',
        'bank_name': 'GTBank',
        'bank_account_number': '0123456789',
        'bank_account_name': 'ADELEKE LOGISTICS AND STORAGE',
    },
    owner3: {
        'business_name': 'Fashola Industrial Services Ltd',
        'business_description': 'Oil & gas crane, transport, and yard services across Port Harcourt, Warri, and Ibadan.',
        'bank_name': 'Access Bank',
        'bank_account_number': '0056789012',
        'bank_account_name': 'FASHOLA INDUSTRIAL SERVICES LTD',
    },
    owner4: {
        'business_name': 'Ibrahim Northern Cranes & Logistics',
        'business_description': 'Heavy lift, earthmoving, and warehouse solutions across Abuja, Kano, and Northern Nigeria.',
        'bank_name': 'UBA',
        'bank_account_number': '2098765432',
        'bank_account_name': 'IBRAHIM NORTHERN CRANES AND LOGISTICS',
    },
    dual: {
        'business_name': 'Eze Multi-Resources',
        'business_description': 'Diverse equipment fleet and yard solutions in Lagos.',
        'bank_name': 'Zenith Bank',
        'bank_account_number': '2012345678',
        'bank_account_name': 'CHIDI EZE',
    },
}

for owner_user, profile_data in OWNER_PROFILES.items():
    profile, created = OwnerProfile.objects.get_or_create(user=owner_user)
    if created or not profile.business_name:
        for field, value in profile_data.items():
            setattr(profile, field, value)
        profile.save()
        print(f"  Created owner profile: {profile_data['business_name']}")

print("\nSeed complete.")
print(f"  Listings created this run: {created_count} / {len(SEED_LISTINGS)} total defined")
print("\nTest credentials (all passwords: test1234!):")
print("  owner1@test.com  — Lagos cranes & excavators (Okafor Heavy Equipment)")
print("  owner2@test.com  — Lagos vehicles & warehouses (Adeleke Logistics)")
print("  owner3@test.com  — PH / Warri / Ibadan (Fashola Industrial Services)")
print("  owner4@test.com  — Abuja / Kano (Ibrahim Northern Cranes)")
print("  dual@test.com    — Owner + Renter (Eze Multi-Resources)")
print("  renter1@test.com — Renter")
print("  renter2@test.com — Renter")
print("  admin@terminal.app — Django Admin (password: admin1234!)")
