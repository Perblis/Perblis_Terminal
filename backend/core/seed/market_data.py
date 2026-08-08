"""The demo marketplace catalogue: suppliers, yards, listings, hirers, hires.

Pure data — no Django imports — so it can be linted, diffed and reviewed as a
document. ``seed_market`` turns it into rows.

Conventions
-----------
* Money is **integer kobo** (Commandment 2). ``_n(95_000)`` reads as ₦95,000/day
  and yields ``9_500_000`` kobo; nothing here ever stores naira.
* ``ref`` on a listing is a stable handle the hire script points at, so hire
  history survives re-ordering the catalogue.
* ``photo`` names a pool in ``photos.json``; the seeder attaches that pool's
  images in order, rotating so two listings of the same type don't open with the
  identical cover shot.
* Coordinates are real industrial locations — Apapa, Tin Can, Onne, Idu,
  Bompai — so the map reads like the Nigerian heavy-asset market it models.
"""

from __future__ import annotations

# Emails live on a reserved-invalid TLD (RFC 2606): the seeder can never send
# real mail to a demo account, and `--clear` can match on it exactly.
DEMO_EMAIL_DOMAIN = "terminal-demo.invalid"


def _n(naira: int) -> int:
    """Naira → integer kobo. The only place a naira figure is written down."""
    return naira * 100


# --- suppliers -------------------------------------------------------------
# Each entry: the business, its yards (real coordinates), and its Live supply.
# Businesses are invented; any resemblance to a trading Nigerian company is
# unintended — demo data must never imply a real firm has listed here.

SUPPLIERS: list[dict] = [
    {
        "slug": "harbourline",
        "business_name": "Harbourline Plant Services Ltd",
        "contact_name": "Emeka Nwosu",
        "phone": "+2348031000101",
        "bank_name": "Guaranty Trust Bank",
        "description": (
            "Earthmoving and lifting plant for the Apapa–Ijora corridor since 2009. "
            "All machines are hired with a certified operator, fuel and on-site "
            "maintenance cover. Mobilisation within Lagos is quoted separately; "
            "weekend and night-shift work available on request."
        ),
        "yards": [
            {
                "name": "Apapa Wharf Yard",
                "address": "12 Creek Road, Apapa Industrial Estate",
                "city": "Lagos",
                "lng": 3.3600,
                "lat": 6.4433,
            },
            {
                "name": "Ijora Plant Depot",
                "address": "Ijora Causeway, off Apapa–Oshodi Expressway",
                "city": "Lagos",
                "lng": 3.3712,
                "lat": 6.4698,
            },
        ],
        "listings": [
            {
                "ref": "harbourline-cat320d",
                "yard": 0,
                "asset_class": "plant_machinery",
                "asset_type": "Excavator",
                "photo": "excavator",
                "title": "Caterpillar 320D Excavator — 22t, operator included",
                "description": (
                    "Well-maintained CAT 320D tracked excavator on a 22-tonne class "
                    "chassis, suited to bulk excavation, drainage and demolition "
                    "support. Hour meter verified at last service; hydraulic breaker "
                    "available as an add-on. Comes with a certified operator and "
                    "fuel for a standard 8-hour shift."
                ),
                "specs": {
                    "make": "Caterpillar",
                    "model": "320D",
                    "year": 2019,
                    "condition": "Good",
                    "operator_included": "Included",
                    "operating_weight": 22,
                    "bucket_capacity": 1.2,
                    "max_dig_depth": 6.7,
                    "engine_power": 148,
                    "hours_logged": 9400,
                    "fuel_type": "Diesel",
                    "tracked_or_wheeled": "Tracked",
                    "boom_config": "Standard",
                    "operator_experience": 11,
                },
                "daily_price": _n(210_000),
                "weekly_price": _n(1_260_000),
                "monthly_price": _n(4_600_000),
                "unit_count": 2,
            },
            {
                "ref": "harbourline-pc200",
                "yard": 0,
                "asset_class": "plant_machinery",
                "asset_type": "Excavator",
                "photo": "excavator",
                "title": "Komatsu PC200-8 Excavator — 20t, long-reach boom",
                "description": (
                    "Long-reach PC200-8 configured for canal desilting and shoreline "
                    "work around Apapa and Ijora. Reaches 9.5 m dig depth. Operator "
                    "included; hirer provides site access and security."
                ),
                "specs": {
                    "make": "Komatsu",
                    "model": "PC200-8",
                    "year": 2018,
                    "condition": "Good",
                    "operator_included": "Included",
                    "operating_weight": 20,
                    "bucket_capacity": 0.8,
                    "max_dig_depth": 9.5,
                    "engine_power": 138,
                    "hours_logged": 12200,
                    "fuel_type": "Diesel",
                    "tracked_or_wheeled": "Tracked",
                    "boom_config": "Long-reach",
                },
                "daily_price": _n(235_000),
                "weekly_price": _n(1_400_000),
                "unit_count": 1,
            },
            {
                "ref": "harbourline-loader",
                "yard": 0,
                "asset_class": "plant_machinery",
                "asset_type": "Wheel Loader / Backhoe",
                "photo": "wheel-loader",
                "title": "SDLG LG958L Wheel Loader — 3.0 m³ bucket",
                "description": (
                    "Yard loader for stockpiling, truck-charging and aggregate "
                    "handling. Reliable on laterite and concrete hardstanding; a "
                    "regular on Apapa aggregate contracts. Operator included."
                ),
                "specs": {
                    "make": "SDLG",
                    "model": "LG958L",
                    "year": 2020,
                    "condition": "Excellent",
                    "operator_included": "Included",
                    "operating_weight": 17,
                    "bucket_capacity": 3.0,
                    "lift_capacity": 5,
                    "engine_power": 220,
                    "hours_logged": 6100,
                    "fuel_type": "Diesel",
                },
                "daily_price": _n(165_000),
                "weekly_price": _n(980_000),
                "monthly_price": _n(3_600_000),
                "unit_count": 2,
            },
            {
                "ref": "harbourline-dozer",
                "yard": 1,
                "asset_class": "plant_machinery",
                "asset_type": "Bulldozer",
                "photo": "bulldozer",
                "title": "Komatsu D65 Bulldozer — straight blade with ripper",
                "description": (
                    "D65-class dozer for site clearance, spoil pushing and haul-road "
                    "formation. Rear ripper fitted. Suited to reclamation and estate "
                    "earthworks across Lagos mainland."
                ),
                "specs": {
                    "make": "Komatsu",
                    "model": "D65EX-15",
                    "year": 2017,
                    "condition": "Good",
                    "operator_included": "Included",
                    "operating_weight": 20,
                    "blade_type": "Straight",
                    "blade_width": 3.4,
                    "ripper": True,
                    "engine_power": 205,
                    "hours_logged": 14800,
                    "fuel_type": "Diesel",
                },
                "daily_price": _n(240_000),
                "weekly_price": _n(1_450_000),
                "unit_count": 1,
            },
            {
                "ref": "harbourline-crane50",
                "yard": 1,
                "asset_class": "plant_machinery",
                "asset_type": "Mobile Crane",
                "photo": "mobile-crane",
                "title": "XCMG QY50 Mobile Crane — 50t truck-mounted",
                "description": (
                    "50-tonne truck-mounted crane with 40 m main boom, certified and "
                    "load-tested. Used on precast erection, tank lifts and plant "
                    "installation. Rigger and banksman available at extra cost; "
                    "lift plan and insurance certificate provided on request."
                ),
                "specs": {
                    "make": "XCMG",
                    "model": "QY50KA",
                    "year": 2019,
                    "condition": "Good",
                    "operator_included": "Included",
                    "operating_weight": 40,
                    "max_lift_capacity": 50,
                    "boom_length": 40,
                    "jib_length": 15,
                    "crane_type": "Truck-mounted",
                    "certifications": "Load test certificate valid to Nov 2026",
                    "fuel_type": "Diesel",
                },
                "daily_price": _n(480_000),
                "weekly_price": _n(2_900_000),
                "unit_count": 1,
            },
        ],
    },
    {
        "slug": "transatlantic",
        "business_name": "Trans-Atlantic Haulage Nigeria Ltd",
        "contact_name": "Bode Ogunremi",
        "phone": "+2348031000102",
        "bank_name": "Zenith Bank",
        "description": (
            "Container and bulk haulage out of Tin Can Island and Apapa. Fleet of "
            "tippers, truck heads and lowbeds with tracked movements and licensed "
            "drivers. Nationwide runs quoted per trip; daily hire available for "
            "project work."
        ),
        "yards": [
            {
                "name": "Tin Can Truck Park",
                "address": "Tin Can Island Port Access Road, Kirikiri",
                "city": "Lagos",
                "lng": 3.3305,
                "lat": 6.4402,
            },
            {
                "name": "Mile 2 Staging Yard",
                "address": "Mile 2, Amuwo-Odofin, off Badagry Expressway",
                "city": "Lagos",
                "lng": 3.3098,
                "lat": 6.4601,
            },
        ],
        "listings": [
            {
                "ref": "transatlantic-tipper30",
                "yard": 0,
                "asset_class": "trucks_haulage",
                "asset_type": "Tipper / Dump Truck",
                "photo": "tipper",
                "title": "Howo 30-tonne Tipper — sand, granite and spoil",
                "description": (
                    "Sinotruk Howo 10-tyre tipper on daily hire for aggregate supply "
                    "and spoil removal. Driver included, fuel on hirer's account for "
                    "runs beyond 60 km. Four identical units available — ideal for a "
                    "continuous earthworks cycle."
                ),
                "specs": {
                    "make": "Sinotruk",
                    "model": "Howo A7",
                    "year": 2021,
                    "condition": "Good",
                    "driver_included": "Included",
                    "operating_range": "South-West",
                    "payload_capacity": 30,
                    "axle_config": "10-tyre",
                    "bucket_capacity": 18,
                    "insurance_cover": "Comprehensive",
                    "registration_state": "Lagos",
                },
                "daily_price": _n(155_000),
                "weekly_price": _n(920_000),
                "monthly_price": _n(3_400_000),
                "unit_count": 4,
            },
            {
                "ref": "transatlantic-truckhead",
                "yard": 0,
                "asset_class": "trucks_haulage",
                "asset_type": "Truck Head (tractor unit)",
                "photo": "truck-head",
                "title": "MAN TGS 6×4 Truck Head — container pulling",
                "description": (
                    "Tractor unit for 20ft and 40ft container movements from Tin Can "
                    "and Apapa to inland depots. Driver included with valid port "
                    "access. Trailer available on request at extra cost."
                ),
                "specs": {
                    "make": "MAN",
                    "model": "TGS 33.400",
                    "year": 2020,
                    "condition": "Good",
                    "driver_included": "Included",
                    "operating_range": "Nationwide",
                    "payload_capacity": 40,
                    "axle_config": "6×4",
                    "horse_power": 400,
                    "insurance_cover": "Comprehensive",
                    "registration_state": "Lagos",
                },
                "daily_price": _n(185_000),
                "weekly_price": _n(1_120_000),
                "unit_count": 3,
            },
            {
                "ref": "transatlantic-lowbed",
                "yard": 1,
                "asset_class": "trucks_haulage",
                "asset_type": "Lowbed / Lowboy Trailer",
                "photo": "lowbed",
                "title": "60-tonne Lowbed Trailer — plant movement",
                "description": (
                    "Hydraulic-ramp lowbed for moving excavators, dozers and "
                    "transformers. Escort vehicle and route permit handling included "
                    "on Lagos–Ibadan and Lagos–Benin corridors."
                ),
                "specs": {
                    "make": "Fuwa",
                    "model": "3-axle Lowbed",
                    "year": 2019,
                    "condition": "Good",
                    "driver_included": "Included",
                    "operating_range": "Nationwide",
                    "payload_capacity": 60,
                    "max_load": 60,
                    "deck_length": 12.5,
                    "ramps": True,
                    "insurance_cover": "Comprehensive",
                },
                "daily_price": _n(320_000),
                "weekly_price": _n(1_950_000),
                "unit_count": 2,
            },
            {
                "ref": "transatlantic-flatbed",
                "yard": 1,
                "asset_class": "trucks_haulage",
                "asset_type": "Flatbed Truck",
                "photo": "flatbed",
                "title": "Flatbed Truck 15t — steel, pipes and precast",
                "description": (
                    "Open flatbed for long loads: rebar, scaffold, pipe and precast "
                    "sections. Load securing kit supplied. Lagos and South-West runs."
                ),
                "specs": {
                    "make": "Mercedes-Benz",
                    "model": "Actros 2640",
                    "year": 2018,
                    "condition": "Good",
                    "driver_included": "Included",
                    "operating_range": "South-West",
                    "payload_capacity": 15,
                    "deck_length": 12.0,
                    "deck_width": 2.4,
                    "insurance_cover": "Third-party",
                },
                "daily_price": _n(130_000),
                "weekly_price": _n(780_000),
                "unit_count": 2,
            },
            {
                "ref": "transatlantic-tanker",
                "yard": 0,
                "asset_class": "trucks_haulage",
                "asset_type": "Fuel / Chemical Tanker",
                "photo": "tanker",
                "title": "33,000-litre PMS/AGO Tanker — DPR-compliant",
                "description": (
                    "Articulated fuel tanker with calibration certificate and fire "
                    "suppression kit. Driver holds hazardous-goods endorsement. Used "
                    "for site diesel supply and depot-to-depot transfers."
                ),
                "specs": {
                    "make": "Scania",
                    "model": "P410",
                    "year": 2020,
                    "condition": "Excellent",
                    "driver_included": "Included",
                    "operating_range": "Nationwide",
                    "payload_capacity": 28,
                    "tank_capacity": 33000,
                    "compartments": 4,
                    "product_class": "PMS-AGO",
                    "insurance_cover": "Comprehensive",
                },
                "daily_price": _n(275_000),
                "weekly_price": _n(1_650_000),
                "unit_count": 1,
            },
        ],
    },
    {
        "slug": "oregun-lifting",
        "business_name": "Oregun Crane & Lifting Co Ltd",
        "contact_name": "Ifeoma Chukwu",
        "phone": "+2348031000103",
        "bank_name": "Access Bank",
        "description": (
            "Specialist lifting contractor: mobile cranes, tower cranes and access "
            "equipment with in-house lift planning. All appliances are thorough-"
            "examination certified. We supply appointed persons and slinger-signallers "
            "for complex lifts."
        ),
        "yards": [
            {
                "name": "Oregun Lifting Yard",
                "address": "Kudirat Abiola Way, Oregun, Ikeja",
                "city": "Lagos",
                "lng": 3.3629,
                "lat": 6.6088,
            }
        ],
        "listings": [
            {
                "ref": "oregun-crane80",
                "yard": 0,
                "asset_class": "plant_machinery",
                "asset_type": "Mobile Crane",
                "photo": "mobile-crane",
                "title": "Liebherr LTM 1080 All-Terrain Crane — 80t",
                "description": (
                    "80-tonne all-terrain crane for heavy structural steel and tank "
                    "erection. 50 m telescopic boom plus swing-away jib. Comes with "
                    "operator and appointed person; ground-bearing assessment and "
                    "lift plan produced before mobilisation."
                ),
                "specs": {
                    "make": "Liebherr",
                    "model": "LTM 1080-1",
                    "year": 2016,
                    "condition": "Good",
                    "operator_included": "Included",
                    "operating_weight": 48,
                    "max_lift_capacity": 80,
                    "boom_length": 50,
                    "jib_length": 19,
                    "crane_type": "All-terrain",
                    "certifications": "LOLER thorough examination, Mar 2026",
                },
                "daily_price": _n(750_000),
                "weekly_price": _n(4_500_000),
                "unit_count": 1,
            },
            {
                "ref": "oregun-hiab",
                "yard": 0,
                "asset_class": "trucks_haulage",
                "asset_type": "Crane Truck (Hiab)",
                "photo": "crane-truck",
                "title": "Hiab 12t Crane Truck — self-loading deliveries",
                "description": (
                    "Truck-mounted knuckle-boom crane for generator drops, transformer "
                    "placement and site deliveries where no crane is standing. Reaches "
                    "16 m. One-vehicle solution: it carries and it lifts."
                ),
                "specs": {
                    "make": "Hiab",
                    "model": "X-HiPro 232",
                    "year": 2021,
                    "condition": "Excellent",
                    "driver_included": "Included",
                    "operating_range": "Lagos only",
                    "payload_capacity": 12,
                    "crane_capacity": 12,
                    "crane_reach": 16,
                    "insurance_cover": "Comprehensive",
                },
                "daily_price": _n(265_000),
                "weekly_price": _n(1_580_000),
                "unit_count": 2,
            },
            {
                "ref": "oregun-towercrane",
                "yard": 0,
                "asset_class": "plant_machinery",
                "asset_type": "Tower Crane",
                "photo": "tower-crane",
                "title": "Potain MC 85 Tower Crane — monthly hire, erection included",
                "description": (
                    "Saddle-jib tower crane for mid-rise construction, hired monthly "
                    "with erection, dismantling and mast sections. 52 m jib, 5-tonne "
                    "maximum capacity. Foundation design supplied to the hirer's "
                    "structural engineer."
                ),
                "specs": {
                    "make": "Potain",
                    "model": "MC 85 B",
                    "year": 2015,
                    "condition": "Good",
                    "operator_included": "Available (extra)",
                    "operating_weight": 32,
                    "max_lift_capacity": 5,
                    "jib_length": 52,
                    "max_height": 47,
                    "certifications": "Annual thorough examination current",
                },
                "daily_price": _n(420_000),
                "monthly_price": _n(7_800_000),
                "unit_count": 1,
            },
            {
                "ref": "oregun-boomlift",
                "yard": 0,
                "asset_class": "plant_machinery",
                "asset_type": "Boom / Scissor Lift",
                "photo": "boom-lift",
                "title": "Genie S-65 Telescopic Boom Lift — 20 m working height",
                "description": (
                    "Diesel 4×4 boom lift for façade, cladding and high-level M&E "
                    "work. Rough-terrain tyres suit unfinished sites. Familiarisation "
                    "for the hirer's operators included on the first day."
                ),
                "specs": {
                    "make": "Genie",
                    "model": "S-65",
                    "year": 2019,
                    "condition": "Good",
                    "operator_included": "Not available",
                    "operating_weight": 10,
                    "working_height": 20,
                    "platform_capacity": 227,
                    "power": "Diesel",
                    "fuel_type": "Diesel",
                },
                "daily_price": _n(145_000),
                "weekly_price": _n(870_000),
                "monthly_price": _n(3_100_000),
                "unit_count": 3,
            },
        ],
    },
    {
        "slug": "bluewater",
        "business_name": "Bluewater Depot & Terminals Ltd",
        "contact_name": "Ahmed Bello",
        "phone": "+2348031000104",
        "bank_name": "United Bank for Africa",
        "description": (
            "Bonded container depot and off-dock storage minutes from Apapa. Customs-"
            "licensed, 24-hour gate, tally and inventory reporting. We take overflow "
            "from the terminals when the port is congested."
        ),
        "yards": [
            {
                "name": "Bluewater Bonded Depot",
                "address": "Point Road, Apapa, off Wharf Road",
                "city": "Lagos",
                "lng": 3.3556,
                "lat": 6.4487,
            }
        ],
        "listings": [
            {
                "ref": "bluewater-depot",
                "yard": 0,
                "asset_class": "terminals_yards",
                "asset_type": "Container Yard / Bonded Depot",
                "photo": "container-yard",
                "title": "Apapa Bonded Container Depot — 450 TEU, 24/7 gate",
                "description": (
                    "Customs-bonded depot on concrete hardstanding with reach stacker "
                    "and empty handler on site. Round-the-clock gate with tally and "
                    "daily stock reporting. Reefer plugs available. Two kilometres "
                    "from the Apapa terminal gate."
                ),
                "specs": {
                    "total_area": 12000,
                    "surface_type": "Concrete",
                    "customs_status": "Bonded",
                    "operating_hours": "24-7",
                    "container_capacity": 450,
                    "handling_equipment": ["Reach stacker", "Empty handler", "Forklift"],
                    "gate_system": "Gate + tally",
                    "weighbridge": True,
                    "reefer_plugs": 24,
                    "port_distance": 2,
                },
                "daily_price": _n(620_000),
                "weekly_price": _n(3_700_000),
                "monthly_price": _n(13_500_000),
                "unit_count": 1,
            },
            {
                "ref": "bluewater-icd",
                "yard": 0,
                "asset_class": "terminals_yards",
                "asset_type": "ICD",
                "photo": "container-yard",
                "title": "Inland Container Depot — customs examination bay",
                "description": (
                    "ICD-licensed facility with a dedicated customs examination area, "
                    "covered stripping bay and CCTV throughout. Suited to importers "
                    "consolidating cargo away from the port apron."
                ),
                "specs": {
                    "total_area": 8500,
                    "surface_type": "Interlocked",
                    "customs_status": "ICD-licensed",
                    "operating_hours": "Day shift",
                    "container_capacity": 300,
                    "handling_equipment": ["Reach stacker", "Forklift"],
                    "gate_system": "Automated",
                    "weighbridge": True,
                    "customs_examination_area": True,
                    "port_distance": 4,
                },
                "daily_price": _n(450_000),
                "monthly_price": _n(10_200_000),
                "unit_count": 1,
            },
            {
                "ref": "bluewater-reachstacker",
                "yard": 0,
                "asset_class": "trucks_haulage",
                "asset_type": "Reach Stacker / Container Handler",
                "photo": "reach-stacker",
                "title": "Kalmar DRF450 Reach Stacker — 45t, 5-high",
                "description": (
                    "Container handler for depot and yard operations, stacking five "
                    "high in the first row. Operator included. Available for short "
                    "cover when a hirer's own machine is down for service."
                ),
                "specs": {
                    "make": "Kalmar",
                    "model": "DRF450-60S5",
                    "year": 2017,
                    "condition": "Good",
                    "driver_included": "Included",
                    "operating_range": "Lagos only",
                    "payload_capacity": 45,
                    "lift_capacity": 45,
                    "stacking_height": 5,
                    "container_sizes": ["20ft", "40ft", "45ft"],
                    "insurance_cover": "Comprehensive",
                },
                "daily_price": _n(390_000),
                "weekly_price": _n(2_340_000),
                "unit_count": 2,
            },
        ],
    },
    {
        "slug": "sahara-earthmovers",
        "business_name": "Sahara Earthmovers Nigeria Ltd",
        "contact_name": "Musa Ibrahim",
        "phone": "+2348031000105",
        "bank_name": "First Bank of Nigeria",
        "description": (
            "Road and civils plant serving the Federal Capital Territory and the "
            "North-Central corridor. Graders, rollers and dozers with operators "
            "experienced on federal road contracts."
        ),
        "yards": [
            {
                "name": "Idu Industrial Yard",
                "address": "Idu Industrial Area, Phase 2",
                "city": "Abuja",
                "lng": 7.3612,
                "lat": 9.0103,
            }
        ],
        "listings": [
            {
                "ref": "sahara-grader",
                "yard": 0,
                "asset_class": "plant_machinery",
                "asset_type": "Grader",
                "photo": "grader",
                "title": "Caterpillar 140K Motor Grader — road formation",
                "description": (
                    "Motor grader for subgrade trimming, camber formation and haul-"
                    "road maintenance. Operator with federal highway experience. "
                    "Available for FCT and Nasarawa contracts."
                ),
                "specs": {
                    "make": "Caterpillar",
                    "model": "140K",
                    "year": 2018,
                    "condition": "Good",
                    "operator_included": "Included",
                    "operating_weight": 18,
                    "blade_width": 3.7,
                    "engine_power": 180,
                    "hours_logged": 11200,
                    "fuel_type": "Diesel",
                },
                "daily_price": _n(225_000),
                "weekly_price": _n(1_350_000),
                "unit_count": 1,
            },
            {
                "ref": "sahara-roller",
                "yard": 0,
                "asset_class": "plant_machinery",
                "asset_type": "Roller / Compactor",
                "photo": "roller",
                "title": "Bomag BW 212 Single-Drum Roller — 12t vibratory",
                "description": (
                    "Smooth-drum vibratory roller for subbase and embankment "
                    "compaction. Density testing support available through our "
                    "materials partner. Operator included."
                ),
                "specs": {
                    "make": "Bomag",
                    "model": "BW 212 D-4",
                    "year": 2019,
                    "condition": "Excellent",
                    "operator_included": "Included",
                    "operating_weight": 12,
                    "drum_type": "Smooth",
                    "drum_width": 2.1,
                    "vibratory": True,
                    "engine_power": 130,
                    "fuel_type": "Diesel",
                },
                "daily_price": _n(135_000),
                "weekly_price": _n(810_000),
                "monthly_price": _n(2_950_000),
                "unit_count": 2,
            },
            {
                "ref": "sahara-excavator",
                "yard": 0,
                "asset_class": "plant_machinery",
                "asset_type": "Excavator",
                "photo": "excavator",
                "title": "Hitachi ZX210 Excavator — 21t, Abuja based",
                "description": (
                    "General-purpose tracked excavator for drainage, foundations and "
                    "bulk dig on FCT sites. Operator included; low-bed transport "
                    "arranged separately."
                ),
                "specs": {
                    "make": "Hitachi",
                    "model": "ZX210-5G",
                    "year": 2019,
                    "condition": "Good",
                    "operator_included": "Included",
                    "operating_weight": 21,
                    "bucket_capacity": 0.9,
                    "max_dig_depth": 6.6,
                    "engine_power": 160,
                    "hours_logged": 8300,
                    "fuel_type": "Diesel",
                    "tracked_or_wheeled": "Tracked",
                },
                "daily_price": _n(200_000),
                "weekly_price": _n(1_200_000),
                "unit_count": 2,
            },
            {
                "ref": "sahara-dozer",
                "yard": 0,
                "asset_class": "plant_machinery",
                "asset_type": "Bulldozer",
                "photo": "bulldozer",
                "title": "Shantui SD16 Bulldozer — 17t site clearance",
                "description": (
                    "Mid-size dozer for clearing, levelling and stockpile management. "
                    "Economical on fuel for its class. Operator included."
                ),
                "specs": {
                    "make": "Shantui",
                    "model": "SD16",
                    "year": 2020,
                    "condition": "Good",
                    "operator_included": "Included",
                    "operating_weight": 17,
                    "blade_type": "Straight",
                    "blade_width": 3.3,
                    "ripper": False,
                    "engine_power": 160,
                    "fuel_type": "Diesel",
                },
                "daily_price": _n(190_000),
                "weekly_price": _n(1_140_000),
                "unit_count": 1,
            },
        ],
    },
    {
        "slug": "onne-logistics",
        "business_name": "Onne Port Logistics Ltd",
        "contact_name": "Tamuno Briggs",
        "phone": "+2348031000106",
        "bank_name": "Fidelity Bank",
        "description": (
            "Oil-and-gas logistics support out of Onne and Trans-Amadi: laydown, "
            "container storage and equipment handling for the Rivers State energy "
            "corridor. Free-zone documentation handled in house."
        ),
        "yards": [
            {
                "name": "Onne Free Zone Yard",
                "address": "Federal Ocean Terminal, Onne",
                "city": "Port Harcourt",
                "lng": 7.1521,
                "lat": 4.7108,
            },
            {
                "name": "Trans-Amadi Depot",
                "address": "Trans-Amadi Industrial Layout",
                "city": "Port Harcourt",
                "lng": 7.0214,
                "lat": 4.8092,
            },
        ],
        "listings": [
            {
                "ref": "onne-terminal",
                "yard": 0,
                "asset_class": "terminals_yards",
                "asset_type": "Port Terminal",
                "photo": "port-terminal",
                "title": "Onne Free Zone Terminal Apron — project cargo",
                "description": (
                    "Quay-adjacent apron for project and out-of-gauge cargo, inside "
                    "the Oil & Gas Free Zone. Heavy-load paving rated for module "
                    "roll-out. Berth access coordinated with the terminal operator."
                ),
                "specs": {
                    "total_area": 20000,
                    "surface_type": "Concrete",
                    "customs_status": "Bonded",
                    "operating_hours": "24-7",
                    "container_capacity": 700,
                    "handling_equipment": ["Reach stacker", "Crane", "Forklift"],
                    "berth_access": True,
                    "weighbridge": True,
                    "rail_access": False,
                    "max_vessel_draft": 11,
                    "port_distance": 1,
                },
                "daily_price": _n(980_000),
                "monthly_price": _n(22_000_000),
                "unit_count": 1,
            },
            {
                "ref": "onne-laydown",
                "yard": 0,
                "asset_class": "land_staging",
                "asset_type": "Laydown",
                "photo": "laydown",
                "title": "Onne Laydown Yard — 6,000 sqm, heavy plant rated",
                "description": (
                    "Fenced, lit laydown for pipe, structural steel and drilling "
                    "spreads. Weighbridge on site, 24-hour guarding, and a "
                    "trailer-accessible gate off the FOT approach road."
                ),
                "specs": {
                    "area": 6000,
                    "fencing": "Fully fenced",
                    "access_road": "Trailer-accessible",
                    "surface_type": "Compacted laterite",
                    "weight_bearing": "Heavy plant OK",
                    "zoning": "Industrial",
                    "gradient": "Level",
                    "security": ["Fenced", "Guards 24-7", "CCTV"],
                    "utilities": ["Power", "Water", "Drainage"],
                },
                "daily_price": _n(310_000),
                "monthly_price": _n(7_100_000),
                "unit_count": 1,
            },
            {
                "ref": "onne-forklift",
                "yard": 1,
                "asset_class": "plant_machinery",
                "asset_type": "Forklift (industrial)",
                "photo": "forklift",
                "title": "Hyster 7-tonne Diesel Forklift — yard duty",
                "description": (
                    "Heavy-duty diesel forklift for pipe bundles, skids and palletised "
                    "cargo. Solid tyres for yard surfaces. Operator included."
                ),
                "specs": {
                    "make": "Hyster",
                    "model": "H7.0FT",
                    "year": 2019,
                    "condition": "Good",
                    "operator_included": "Included",
                    "operating_weight": 10,
                    "lift_capacity": 7,
                    "lift_height": 4.5,
                    "tyre_type": "Solid",
                    "fuel_type": "Diesel",
                },
                "daily_price": _n(120_000),
                "weekly_price": _n(720_000),
                "monthly_price": _n(2_600_000),
                "unit_count": 3,
            },
            {
                "ref": "onne-flatbed",
                "yard": 1,
                "asset_class": "trucks_haulage",
                "asset_type": "Flatbed Truck",
                "photo": "flatbed",
                "title": "Flatbed 20t — Rivers and Bayelsa runs",
                "description": (
                    "Flatbed for pipe, casing and equipment movement across the "
                    "Niger Delta. Driver included, permits handled."
                ),
                "specs": {
                    "make": "Iveco",
                    "model": "Trakker 380",
                    "year": 2019,
                    "condition": "Good",
                    "driver_included": "Included",
                    "operating_range": "Nationwide",
                    "payload_capacity": 20,
                    "deck_length": 12.2,
                    "deck_width": 2.5,
                    "insurance_cover": "Comprehensive",
                },
                "daily_price": _n(150_000),
                "weekly_price": _n(900_000),
                "unit_count": 2,
            },
        ],
    },
    {
        "slug": "ikorodu-park",
        "business_name": "Ikorodu Industrial Park Ltd",
        "contact_name": "Adebayo Salami",
        "phone": "+2348031000107",
        "bank_name": "Sterling Bank",
        "description": (
            "Serviced industrial land and warehousing on the Ikorodu–Sagamu axis. "
            "Titled plots, graded hardstanding and estate security, aimed at "
            "manufacturers and contractors needing space outside the city core."
        ),
        "yards": [
            {
                "name": "Ikorodu Park North",
                "address": "Ikorodu–Sagamu Road, Odogunyan",
                "city": "Ikorodu",
                "lng": 3.5104,
                "lat": 6.6215,
            }
        ],
        "listings": [
            {
                "ref": "ikorodu-land",
                "yard": 0,
                "asset_class": "land_staging",
                "asset_type": "Industrial Land",
                "photo": "industrial-land",
                "title": "Industrial Plot 10,000 sqm — titled, fenced, power ready",
                "description": (
                    "Fully fenced industrial plot with a graded laterite surface, "
                    "three-phase power at the boundary and a trailer-accessible "
                    "estate road. Suitable for a temporary batching plant, module "
                    "assembly or long-term equipment storage."
                ),
                "specs": {
                    "area": 10000,
                    "fencing": "Fully fenced",
                    "access_road": "Trailer-accessible",
                    "surface_type": "Compacted laterite",
                    "weight_bearing": "Heavy plant OK",
                    "zoning": "Industrial",
                    "gradient": "Level",
                    "security": ["Fenced", "Guards 24-7"],
                    "utilities": ["Power", "Water", "Drainage"],
                    "condition_notes": "Graded and rolled in Q1 2026; drainage channel along the east boundary.",
                },
                "daily_price": _n(180_000),
                "monthly_price": _n(4_100_000),
                "unit_count": 1,
            },
            {
                "ref": "ikorodu-laydown",
                "yard": 0,
                "asset_class": "land_staging",
                "asset_type": "Laydown",
                "photo": "laydown",
                "title": "Laydown Area 4,000 sqm — short-term project storage",
                "description": (
                    "Open laydown inside the estate perimeter for pipe, formwork and "
                    "plant parking. Billed monthly; minimum one month."
                ),
                "specs": {
                    "area": 4000,
                    "fencing": "Partially",
                    "access_road": "Trailer-accessible",
                    "surface_type": "Compacted laterite",
                    "weight_bearing": "Heavy plant OK",
                    "zoning": "Industrial",
                    "gradient": "Level",
                    "security": ["Fenced", "Guards 24-7"],
                    "utilities": ["Power", "Water"],
                },
                "daily_price": _n(95_000),
                "monthly_price": _n(2_150_000),
                "unit_count": 2,
            },
            {
                "ref": "ikorodu-warehouse",
                "yard": 0,
                "asset_class": "warehousing",
                "asset_type": "Dry Warehouse",
                "photo": "dry-warehouse",
                "title": "Dry Warehouse 2,000 sqm — racked, 9 m clear height",
                "description": (
                    "Steel-portal warehouse with 9 m clear height, installed pallet "
                    "racking and two dock levellers. Three-phase power with a 250 kVA "
                    "backup generator. Trailer turning circle inside the gate."
                ),
                "specs": {
                    "security": ["Fenced", "CCTV", "Guards 24-7", "Access control"],
                    "floor_area": 2000,
                    "power_supply": "Three-phase",
                    "truck_access": "Trailer-accessible",
                    "ceiling_height": 9,
                    "fire_safety": ["Extinguishers", "Hydrants", "Alarms"],
                    "backup_power": True,
                    "loading_bays": 4,
                    "dock_levellers": True,
                    "office_space": True,
                    "racking_installed": True,
                    "pallet_positions": 1800,
                    "floor_load_capacity": 5,
                },
                "daily_price": _n(240_000),
                "monthly_price": _n(5_400_000),
                "unit_count": 1,
            },
        ],
    },
    {
        "slug": "greenfield-cold",
        "business_name": "Greenfield Cold Chain Ltd",
        "contact_name": "Chinelo Obi",
        "phone": "+2348031000108",
        "bank_name": "Stanbic IBTC Bank",
        "description": (
            "Temperature-controlled storage for food, pharmaceutical and agro "
            "exporters. Continuous temperature logging, backup power on automatic "
            "changeover, and HACCP-aligned handling procedures."
        ),
        "yards": [
            {
                "name": "Isolo Cold Hub",
                "address": "Oshodi-Apapa Expressway Service Lane, Isolo",
                "city": "Lagos",
                "lng": 3.3211,
                "lat": 6.5316,
            }
        ],
        "listings": [
            {
                "ref": "greenfield-frozen",
                "yard": 0,
                "asset_class": "warehousing",
                "asset_type": "Cold Storage",
                "photo": "cold-storage",
                "title": "Frozen Store −18°C — 800 sqm, 24/7 monitoring",
                "description": (
                    "Blast-capable frozen chamber held at −18°C with dual compressor "
                    "sets and automatic generator changeover. Temperature logged "
                    "continuously and reported to the hirer weekly. Loading through "
                    "an insulated dock with air curtains."
                ),
                "specs": {
                    "security": ["Fenced", "CCTV", "Access control", "Guards 24-7"],
                    "floor_area": 800,
                    "power_supply": "Three-phase",
                    "truck_access": "Trailer-accessible",
                    "ceiling_height": 7,
                    "temperature_range": "Frozen −18°C",
                    "temperature_monitoring": True,
                    "cold_capacity": 800,
                    "backup_power": True,
                    "loading_bays": 3,
                    "dock_levellers": True,
                    "fire_safety": ["Extinguishers", "Alarms"],
                },
                "daily_price": _n(340_000),
                "monthly_price": _n(7_700_000),
                "unit_count": 1,
            },
            {
                "ref": "greenfield-chilled",
                "yard": 0,
                "asset_class": "warehousing",
                "asset_type": "Cold Storage",
                "photo": "cold-storage",
                "title": "Chilled Store 0–8°C — 500 sqm produce room",
                "description": (
                    "Chilled room for fresh produce and dairy, with humidity control "
                    "and separate receiving bay. Suits exporters staging cargo ahead "
                    "of an airfreight window."
                ),
                "specs": {
                    "security": ["Fenced", "CCTV", "Access control"],
                    "floor_area": 500,
                    "power_supply": "Three-phase",
                    "truck_access": "Trailer-accessible",
                    "ceiling_height": 6,
                    "temperature_range": "Chilled 0–8°C",
                    "temperature_monitoring": True,
                    "cold_capacity": 500,
                    "backup_power": True,
                    "loading_bays": 2,
                },
                "daily_price": _n(220_000),
                "monthly_price": _n(4_950_000),
                "unit_count": 1,
            },
            {
                "ref": "greenfield-dry",
                "yard": 0,
                "asset_class": "warehousing",
                "asset_type": "Dry Warehouse",
                "photo": "dry-warehouse",
                "title": "Ambient Warehouse 1,200 sqm — beside the cold hub",
                "description": (
                    "Ambient dry store adjoining the cold chambers, useful for "
                    "packaging, pallets and non-perishable stock held alongside "
                    "chilled cargo."
                ),
                "specs": {
                    "security": ["Fenced", "CCTV", "Guards 24-7"],
                    "floor_area": 1200,
                    "power_supply": "Three-phase",
                    "truck_access": "Trailer-accessible",
                    "ceiling_height": 8,
                    "backup_power": True,
                    "loading_bays": 2,
                    "racking_installed": True,
                    "pallet_positions": 900,
                    "fire_safety": ["Extinguishers", "Hydrants"],
                },
                "daily_price": _n(160_000),
                "monthly_price": _n(3_600_000),
                "unit_count": 1,
            },
        ],
    },
    {
        "slug": "delta-rig",
        "business_name": "Delta Rig & Equipment Co Ltd",
        "contact_name": "Efe Okoro",
        "phone": "+2348031000109",
        "bank_name": "Union Bank",
        "description": (
            "Drilling, piling and fabrication support for the Warri–Ughelli belt. "
            "Rigs, welding spreads and a licensed fabrication yard with overhead "
            "gantry."
        ),
        "yards": [
            {
                "name": "Ekpan Fabrication Yard",
                "address": "Ekpan, off Warri–Sapele Road",
                "city": "Warri",
                "lng": 5.7602,
                "lat": 5.5591,
            }
        ],
        "listings": [
            {
                "ref": "delta-pilingrig",
                "yard": 0,
                "asset_class": "plant_machinery",
                "asset_type": "Drilling Rig",
                "photo": "drilling-rig",
                "title": "Bauer BG 15 Piling Rig — bored piles to 30 m",
                "description": (
                    "Rotary bored-piling rig for foundations in soft delta ground. "
                    "Casing oscillator available. Crew of three included; the hirer "
                    "provides the piling platform and set-out."
                ),
                "specs": {
                    "make": "Bauer",
                    "model": "BG 15 H",
                    "year": 2016,
                    "condition": "Good",
                    "operator_included": "Included",
                    "operating_weight": 50,
                    "rig_type": "Rotary",
                    "max_drill_depth": 30,
                    "drill_diameter": 1200,
                    "engine_power": 260,
                    "certifications": "Third-party inspection, Jan 2026",
                },
                "daily_price": _n(890_000),
                "weekly_price": _n(5_300_000),
                "unit_count": 1,
            },
            {
                "ref": "delta-fabyard",
                "yard": 0,
                "asset_class": "land_staging",
                "asset_type": "Fabrication Yard",
                "photo": "fabrication-yard",
                "title": "Fabrication Yard 5,000 sqm — 20t gantry, covered bay",
                "description": (
                    "Licensed fabrication yard with a 20-tonne overhead gantry, "
                    "1,000 sqm covered bay, welding power distribution and a "
                    "concrete hardstanding rated for module assembly."
                ),
                "specs": {
                    "area": 5000,
                    "fencing": "Fully fenced",
                    "access_road": "Trailer-accessible",
                    "surface_type": "Concrete",
                    "weight_bearing": "Heavy plant OK",
                    "zoning": "Industrial",
                    "gradient": "Level",
                    "security": ["Fenced", "CCTV", "Guards 24-7"],
                    "utilities": ["Power", "Water", "Drainage"],
                    "covered_area": 1000,
                    "gantry_crane": True,
                    "gantry_crane_capacity": 20,
                },
                "daily_price": _n(420_000),
                "monthly_price": _n(9_500_000),
                "unit_count": 1,
            },
            {
                "ref": "delta-welder",
                "yard": 0,
                "asset_class": "plant_machinery",
                "asset_type": "Welding Machine",
                "photo": "welding-machine",
                "title": "Diesel Welding Generator 400A — site spread",
                "description": (
                    "Engine-driven welder for structural and pipeline work where "
                    "there is no mains supply. Doubles as an auxiliary power source. "
                    "Welder-operator available at extra cost."
                ),
                "specs": {
                    "make": "Lincoln Electric",
                    "model": "Vantage 400",
                    "year": 2020,
                    "condition": "Excellent",
                    "operator_included": "Available (extra)",
                    "output": 400,
                    "power_source": "Diesel",
                    "fuel_type": "Diesel",
                    "operating_weight": 1,
                    "engine_power": 44,
                },
                "daily_price": _n(48_000),
                "weekly_price": _n(285_000),
                "monthly_price": _n(1_050_000),
                "unit_count": 4,
            },
            {
                "ref": "delta-generator",
                "yard": 0,
                "asset_class": "plant_machinery",
                "asset_type": "Generator",
                "photo": "generator",
                "title": "500 kVA Soundproof Generator — site power",
                "description": (
                    "Perkins-powered 500 kVA soundproof set on a skid base, with "
                    "changeover panel and 1,000-litre belly tank. Delivered, "
                    "installed and commissioned; fuel on the hirer's account."
                ),
                "specs": {
                    "make": "Perkins",
                    "model": "2506C-E15TAG2",
                    "year": 2021,
                    "condition": "Excellent",
                    "operator_included": "Not available",
                    "power_output": 500,
                    "phase": "Three",
                    "soundproof": True,
                    "fuel_consumption": 95,
                    "fuel_type": "Diesel",
                    "operating_weight": 5,
                },
                "daily_price": _n(175_000),
                "weekly_price": _n(1_050_000),
                "monthly_price": _n(3_800_000),
                "unit_count": 2,
            },
        ],
    },
    {
        "slug": "northgate",
        "business_name": "Northgate Haulage Ltd",
        "contact_name": "Aisha Yusuf",
        "phone": "+2348031000110",
        "bank_name": "Jaiz Bank",
        "description": (
            "Northern-corridor haulage from Kano: agricultural produce, cement and "
            "general cargo to Lagos, Onitsha and the border posts. Fleet tracked, "
            "drivers vetted, and a covered yard at Bompai."
        ),
        "yards": [
            {
                "name": "Bompai Truck Terminal",
                "address": "Bompai Industrial Area, Kano",
                "city": "Kano",
                "lng": 8.5512,
                "lat": 12.0102,
            }
        ],
        "listings": [
            {
                "ref": "northgate-boxtruck",
                "yard": 0,
                "asset_class": "trucks_haulage",
                "asset_type": "Box / Covered Truck",
                "photo": "box-truck",
                "title": "Covered Box Truck 15t — dry cargo, nationwide",
                "description": (
                    "Enclosed box body for cartoned goods, textiles and agro produce "
                    "needing protection from dust and rain. Tail lift fitted. Driver "
                    "included; nationwide runs."
                ),
                "specs": {
                    "make": "Isuzu",
                    "model": "FVZ",
                    "year": 2021,
                    "condition": "Excellent",
                    "driver_included": "Included",
                    "operating_range": "Nationwide",
                    "payload_capacity": 15,
                    "cargo_volume": 45,
                    "tail_lift": True,
                    "insurance_cover": "Comprehensive",
                    "registration_state": "Kano",
                },
                "daily_price": _n(140_000),
                "weekly_price": _n(840_000),
                "unit_count": 3,
            },
            {
                "ref": "northgate-truckhead",
                "yard": 0,
                "asset_class": "trucks_haulage",
                "asset_type": "Truck Head (tractor unit)",
                "photo": "truck-head",
                "title": "Truck Head 6×4 — Kano–Lagos trunk runs",
                "description": (
                    "Tractor unit for flatbed and container work on the northern "
                    "trunk routes. Driver included with two-man crew on long hauls."
                ),
                "specs": {
                    "make": "Sinotruk",
                    "model": "Howo T7H",
                    "year": 2022,
                    "condition": "Excellent",
                    "driver_included": "Included",
                    "operating_range": "Nationwide",
                    "payload_capacity": 40,
                    "axle_config": "6×4",
                    "horse_power": 440,
                    "insurance_cover": "Comprehensive",
                    "registration_state": "Kano",
                },
                "daily_price": _n(170_000),
                "weekly_price": _n(1_020_000),
                "unit_count": 4,
            },
            {
                "ref": "northgate-bowser",
                "yard": 0,
                "asset_class": "trucks_haulage",
                "asset_type": "Water Bowser",
                "photo": "water-bowser",
                "title": "20,000-litre Water Bowser — dust suppression",
                "description": (
                    "Water tanker with spray bar and pump for haul-road dust "
                    "suppression and compaction water. Common on road contracts "
                    "through the dry season."
                ),
                "specs": {
                    "make": "Mercedes-Benz",
                    "model": "Actros 3340",
                    "year": 2018,
                    "condition": "Good",
                    "driver_included": "Included",
                    "operating_range": "Nationwide",
                    "payload_capacity": 20,
                    "tank_capacity": 20000,
                    "pump": True,
                    "insurance_cover": "Third-party",
                },
                "daily_price": _n(115_000),
                "weekly_price": _n(690_000),
                "unit_count": 2,
            },
        ],
    },
    {
        "slug": "niger-bridge",
        "business_name": "Niger Bridge Logistics Ltd",
        "contact_name": "Chukwudi Eze",
        "phone": "+2348031000111",
        "bank_name": "Ecobank Nigeria",
        "description": (
            "Warehousing and distribution for the Onitsha–Nnewi trading belt. "
            "Bonded and general storage with a bonded-warehouse licence, plus a "
            "delivery fleet for the South-East."
        ),
        "yards": [
            {
                "name": "Onitsha Harbour Yard",
                "address": "Harbour Industrial Layout, Onitsha",
                "city": "Onitsha",
                "lng": 6.7891,
                "lat": 6.1402,
            }
        ],
        "listings": [
            {
                "ref": "nigerbridge-bonded",
                "yard": 0,
                "asset_class": "warehousing",
                "asset_type": "Bonded Warehouse",
                "photo": "bonded-warehouse",
                "title": "Bonded Warehouse 1,500 sqm — duty-deferred storage",
                "description": (
                    "Customs-licensed bonded warehouse allowing importers to defer "
                    "duty while goods are stored. Licence current; customs officer "
                    "attends on scheduled days. Segregated cages available."
                ),
                "specs": {
                    "security": ["Fenced", "CCTV", "Guards 24-7", "Access control"],
                    "floor_area": 1500,
                    "power_supply": "Three-phase",
                    "truck_access": "Trailer-accessible",
                    "ceiling_height": 8,
                    "customs_licence_status": "Active",
                    "licence_expiry": "December 2027",
                    "backup_power": True,
                    "loading_bays": 3,
                    "fire_safety": ["Extinguishers", "Hydrants", "Alarms"],
                    "office_space": True,
                },
                "daily_price": _n(210_000),
                "monthly_price": _n(4_700_000),
                "unit_count": 1,
            },
            {
                "ref": "nigerbridge-dry",
                "yard": 0,
                "asset_class": "warehousing",
                "asset_type": "Dry Warehouse",
                "photo": "dry-warehouse",
                "title": "General Warehouse 900 sqm — Onitsha main market traders",
                "description": (
                    "Straightforward dry storage aimed at traders needing overflow "
                    "space off the main market. Ground-level roller doors, no dock. "
                    "Monthly terms."
                ),
                "specs": {
                    "security": ["Fenced", "Guards 24-7"],
                    "floor_area": 900,
                    "power_supply": "Single-phase",
                    "truck_access": "Light truck only",
                    "ceiling_height": 6,
                    "loading_bays": 2,
                    "fire_safety": ["Extinguishers"],
                },
                "daily_price": _n(85_000),
                "monthly_price": _n(1_900_000),
                "unit_count": 2,
            },
            {
                "ref": "nigerbridge-boxtruck",
                "yard": 0,
                "asset_class": "trucks_haulage",
                "asset_type": "Box / Covered Truck",
                "photo": "box-truck",
                "title": "Delivery Box Truck 7t — South-East distribution",
                "description": (
                    "Mid-size covered truck for last-mile distribution across Anambra, "
                    "Enugu and Imo. Driver and loader included."
                ),
                "specs": {
                    "make": "Mitsubishi",
                    "model": "Canter",
                    "year": 2020,
                    "condition": "Good",
                    "driver_included": "Included",
                    "operating_range": "Nationwide",
                    "payload_capacity": 7,
                    "cargo_volume": 24,
                    "tail_lift": False,
                    "insurance_cover": "Third-party",
                },
                "daily_price": _n(95_000),
                "weekly_price": _n(570_000),
                "unit_count": 3,
            },
        ],
    },
    {
        "slug": "lekki-freezone",
        "business_name": "Lekki Freezone Yard Services Ltd",
        "contact_name": "Olumide Fashola",
        "phone": "+2348031000112",
        "bank_name": "Providus Bank",
        "description": (
            "Container storage, truck marshalling and laydown serving the Lekki Deep "
            "Sea Port and the free-zone manufacturers. Purpose-built after the port "
            "opened; everything is on new concrete."
        ),
        "yards": [
            {
                "name": "Lekki Freezone Yard",
                "address": "Lekki Free Trade Zone, Ibeju-Lekki",
                "city": "Lagos",
                "lng": 3.9762,
                "lat": 6.4231,
            }
        ],
        "listings": [
            {
                "ref": "lekki-containeryard",
                "yard": 0,
                "asset_class": "terminals_yards",
                "asset_type": "Container Yard / Bonded Depot",
                "photo": "container-yard",
                "title": "Lekki Container Yard — 600 TEU on new concrete",
                "description": (
                    "Modern container yard eight kilometres from the Lekki Deep Sea "
                    "Port gate. Automated gate with OCR, weighbridge and reach "
                    "stackers on site. Built to take port overflow at peak."
                ),
                "specs": {
                    "total_area": 15000,
                    "surface_type": "Concrete",
                    "customs_status": "Bonded",
                    "operating_hours": "24-7",
                    "container_capacity": 600,
                    "handling_equipment": ["Reach stacker", "Empty handler"],
                    "gate_system": "Automated",
                    "weighbridge": True,
                    "reefer_plugs": 40,
                    "rail_access": False,
                    "port_distance": 8,
                },
                "daily_price": _n(710_000),
                "monthly_price": _n(16_000_000),
                "unit_count": 1,
            },
            {
                "ref": "lekki-marshalling",
                "yard": 0,
                "asset_class": "land_staging",
                "asset_type": "Marshalling",
                "photo": "marshalling",
                "title": "Truck Marshalling Yard — 120 trailer bays",
                "description": (
                    "Call-up marshalling yard keeping trucks off the access road "
                    "while they wait for a port slot. Ablutions, canteen and driver "
                    "rest area on site. Billed per day per bay block."
                ),
                "specs": {
                    "area": 18000,
                    "fencing": "Fully fenced",
                    "access_road": "Trailer-accessible",
                    "surface_type": "Concrete",
                    "weight_bearing": "Heavy plant OK",
                    "zoning": "Industrial",
                    "gradient": "Level",
                    "security": ["Fenced", "CCTV", "Guards 24-7", "Access control"],
                    "utilities": ["Power", "Water", "Drainage"],
                },
                "daily_price": _n(290_000),
                "monthly_price": _n(6_500_000),
                "unit_count": 1,
            },
            {
                "ref": "lekki-reachstacker",
                "yard": 0,
                "asset_class": "trucks_haulage",
                "asset_type": "Reach Stacker / Container Handler",
                "photo": "reach-stacker",
                "title": "Reach Stacker 45t — free-zone container handling",
                "description": (
                    "Container handler available for hire inside the free zone or "
                    "for mobilisation to a nearby yard. Operator included."
                ),
                "specs": {
                    "make": "Konecranes",
                    "model": "SMV 4531 TB5",
                    "year": 2022,
                    "condition": "Excellent",
                    "driver_included": "Included",
                    "operating_range": "Lagos only",
                    "payload_capacity": 45,
                    "lift_capacity": 45,
                    "stacking_height": 5,
                    "container_sizes": ["20ft", "40ft"],
                    "insurance_cover": "Comprehensive",
                },
                "daily_price": _n(410_000),
                "weekly_price": _n(2_460_000),
                "unit_count": 1,
            },
            {
                "ref": "lekki-laydown",
                "yard": 0,
                "asset_class": "land_staging",
                "asset_type": "Laydown",
                "photo": "laydown",
                "title": "Free Zone Laydown 8,000 sqm — project cargo staging",
                "description": (
                    "Concrete laydown for wind, solar and process-plant components "
                    "landing at Lekki. Crane access on three sides; heavy-lift "
                    "corridor to the port road."
                ),
                "specs": {
                    "area": 8000,
                    "fencing": "Fully fenced",
                    "access_road": "Trailer-accessible",
                    "surface_type": "Concrete",
                    "weight_bearing": "Heavy plant OK",
                    "zoning": "Industrial",
                    "gradient": "Level",
                    "security": ["Fenced", "CCTV", "Guards 24-7"],
                    "utilities": ["Power", "Water", "Drainage"],
                },
                "daily_price": _n(360_000),
                "monthly_price": _n(8_100_000),
                "unit_count": 1,
            },
        ],
    },
    {
        "slug": "cornerstone-plant",
        "business_name": "Cornerstone Plant Hire Nigeria Ltd",
        "contact_name": "Grace Adeleke",
        "phone": "+2348031000113",
        "bank_name": "Wema Bank",
        "description": (
            "Concrete and small-plant hire for Lagos builders: mixers, pumps, "
            "generators, compressors and access equipment. Same-day delivery within "
            "the mainland on stock items."
        ),
        "yards": [
            {
                "name": "Ojota Plant Bay",
                "address": "Ojota Industrial Scheme, off Ikorodu Road",
                "city": "Lagos",
                "lng": 3.3805,
                "lat": 6.5798,
            }
        ],
        "listings": [
            {
                "ref": "cornerstone-mixer",
                "yard": 0,
                "asset_class": "plant_machinery",
                "asset_type": "Concrete Mixer (transit)",
                "photo": "concrete-mixer",
                "title": "Transit Concrete Mixer 8 m³ — ready-mix delivery",
                "description": (
                    "Truck mixer for ready-mix delivery from your batching plant or "
                    "ours. Driver included. Washout facilities available at the "
                    "Ojota bay between loads."
                ),
                "specs": {
                    "make": "Shacman",
                    "model": "F3000",
                    "year": 2021,
                    "condition": "Good",
                    "operator_included": "Included",
                    "drum_capacity": 8,
                    "operating_weight": 25,
                    "engine_power": 340,
                    "fuel_type": "Diesel",
                },
                "daily_price": _n(165_000),
                "weekly_price": _n(990_000),
                "unit_count": 3,
            },
            {
                "ref": "cornerstone-pump",
                "yard": 0,
                "asset_class": "plant_machinery",
                "asset_type": "Concrete Pump",
                "photo": "concrete-pump",
                "title": "Boom Concrete Pump 38 m — slab and column pours",
                "description": (
                    "Truck-mounted boom pump reaching 38 m, for slab pours and "
                    "high-level columns where a crane and skip would be too slow. "
                    "Operator and pipeline crew included; minimum half-day hire."
                ),
                "specs": {
                    "make": "Sany",
                    "model": "SYG5330THB",
                    "year": 2020,
                    "condition": "Good",
                    "operator_included": "Included",
                    "pump_type": "Boom",
                    "boom_reach": 38,
                    "output": 125,
                    "operating_weight": 33,
                    "fuel_type": "Diesel",
                },
                "daily_price": _n(395_000),
                "weekly_price": _n(2_370_000),
                "unit_count": 1,
            },
            {
                "ref": "cornerstone-compressor",
                "yard": 0,
                "asset_class": "plant_machinery",
                "asset_type": "Air Compressor",
                "photo": "air-compressor",
                "title": "Towable Air Compressor 400 cfm — breakers and tools",
                "description": (
                    "Diesel screw compressor on a road-tow chassis, supplied with "
                    "hoses and two jackhammers. Common on demolition and trenching "
                    "jobs where there is no site power."
                ),
                "specs": {
                    "make": "Atlas Copco",
                    "model": "XATS 400",
                    "year": 2019,
                    "condition": "Good",
                    "operator_included": "Not available",
                    "air_delivery": 400,
                    "pressure": 10,
                    "operating_weight": 2,
                    "fuel_type": "Diesel",
                },
                "daily_price": _n(72_000),
                "weekly_price": _n(430_000),
                "monthly_price": _n(1_550_000),
                "unit_count": 4,
            },
            {
                "ref": "cornerstone-scissor",
                "yard": 0,
                "asset_class": "plant_machinery",
                "asset_type": "Boom / Scissor Lift",
                "photo": "scissor-lift",
                "title": "Electric Scissor Lift 12 m — indoor fit-out",
                "description": (
                    "Battery scissor lift for indoor ceiling, ductwork and lighting "
                    "installation. Non-marking tyres, no exhaust — usable inside "
                    "finished buildings and malls."
                ),
                "specs": {
                    "make": "JLG",
                    "model": "3246ES",
                    "year": 2021,
                    "condition": "Excellent",
                    "operator_included": "Not available",
                    "working_height": 12,
                    "platform_capacity": 320,
                    "power": "Electric",
                    "fuel_type": "Electric",
                    "operating_weight": 3,
                },
                "daily_price": _n(68_000),
                "weekly_price": _n(410_000),
                "monthly_price": _n(1_480_000),
                "unit_count": 5,
            },
            {
                "ref": "cornerstone-generator",
                "yard": 0,
                "asset_class": "plant_machinery",
                "asset_type": "Generator",
                "photo": "generator",
                "title": "250 kVA Generator — event and site power",
                "description": (
                    "Soundproof 250 kVA set for site offices, events and short-term "
                    "backup. Delivered on a hook-lift truck with cabling."
                ),
                "specs": {
                    "make": "Cummins",
                    "model": "C250 D5",
                    "year": 2020,
                    "condition": "Good",
                    "operator_included": "Not available",
                    "power_output": 250,
                    "phase": "Three",
                    "soundproof": True,
                    "fuel_consumption": 48,
                    "fuel_type": "Diesel",
                    "operating_weight": 3,
                },
                "daily_price": _n(98_000),
                "weekly_price": _n(590_000),
                "monthly_price": _n(2_150_000),
                "unit_count": 3,
            },
        ],
    },
    {
        "slug": "agbara-warehousing",
        "business_name": "Agbara Warehousing Company Ltd",
        "contact_name": "Segun Adewale",
        "phone": "+2348031000114",
        "bank_name": "Polaris Bank",
        "description": (
            "Grade-A warehousing on the Lagos–Badagry axis at Agbara, serving "
            "manufacturers in the estate and importers who want space outside the "
            "Apapa gridlock."
        ),
        "yards": [
            {
                "name": "Agbara Warehouse Row",
                "address": "Agbara Industrial Estate, Block C",
                "city": "Agbara",
                "lng": 3.0021,
                "lat": 6.5008,
            }
        ],
        "listings": [
            {
                "ref": "agbara-dc",
                "yard": 0,
                "asset_class": "warehousing",
                "asset_type": "Distribution Centre",
                "photo": "distribution-centre",
                "title": "Distribution Centre 5,000 sqm — 12 dock doors, cross-dock",
                "description": (
                    "Purpose-built distribution centre with twelve dock doors, "
                    "cross-dock capability and a 40-trailer yard. Racked to 12 m. "
                    "The strongest fit for an FMCG regional hub."
                ),
                "specs": {
                    "security": ["Fenced", "CCTV", "Guards 24-7", "Access control"],
                    "floor_area": 5000,
                    "power_supply": "Three-phase",
                    "truck_access": "Trailer-accessible",
                    "ceiling_height": 12,
                    "dock_doors": 12,
                    "cross_dock": True,
                    "yard_space": True,
                    "dock_levellers": True,
                    "backup_power": True,
                    "loading_bays": 12,
                    "office_space": True,
                    "floor_load_capacity": 7,
                    "fire_safety": ["Sprinklers", "Hydrants", "Alarms", "Extinguishers"],
                },
                "daily_price": _n(540_000),
                "monthly_price": _n(12_200_000),
                "unit_count": 1,
            },
            {
                "ref": "agbara-dry1",
                "yard": 0,
                "asset_class": "warehousing",
                "asset_type": "Dry Warehouse",
                "photo": "dry-warehouse",
                "title": "Dry Warehouse 3,000 sqm — sprinklered, 10 m clear",
                "description": (
                    "Sprinklered dry warehouse with 10 m clear height and level "
                    "access doors, plus a fenced trailer yard. Suits bulk FMCG, "
                    "building materials and packaging stock."
                ),
                "specs": {
                    "security": ["Fenced", "CCTV", "Guards 24-7"],
                    "floor_area": 3000,
                    "power_supply": "Three-phase",
                    "truck_access": "Trailer-accessible",
                    "ceiling_height": 10,
                    "backup_power": True,
                    "loading_bays": 6,
                    "dock_levellers": True,
                    "racking_installed": False,
                    "floor_load_capacity": 6,
                    "fire_safety": ["Sprinklers", "Extinguishers", "Alarms"],
                    "office_space": True,
                },
                "daily_price": _n(330_000),
                "monthly_price": _n(7_400_000),
                "unit_count": 1,
            },
            {
                "ref": "agbara-selfstore",
                "yard": 0,
                "asset_class": "warehousing",
                "asset_type": "Self-Storage Unit",
                "photo": "self-storage",
                "title": "Self-Storage Units 50–200 sqm — 24/7 access",
                "description": (
                    "Individually secured units for small businesses and contractors "
                    "storing tools, stock or records. Round-the-clock card access; "
                    "monthly rolling terms with no long lease."
                ),
                "specs": {
                    "security": ["Fenced", "CCTV", "Access control", "Guards 24-7"],
                    "floor_area": 200,
                    "power_supply": "Single-phase",
                    "truck_access": "Light truck only",
                    "ceiling_height": 4,
                    "unit_size": 50,
                    "access_hours": "24-7",
                    "climate_controlled": False,
                    "fire_safety": ["Extinguishers", "Alarms"],
                },
                "daily_price": _n(28_000),
                "monthly_price": _n(620_000),
                "unit_count": 8,
            },
        ],
    },
    {
        "slug": "mainland-staging",
        "business_name": "Mainland Staging Grounds Ltd",
        "contact_name": "Kunle Bamidele",
        "phone": "+2348031000115",
        "bank_name": "Keystone Bank",
        "description": (
            "Open ground for contractors: plant parking, material laydown and truck "
            "standing in Amuwo-Odofin, five minutes off the expressway."
        ),
        "yards": [
            {
                "name": "Amuwo Staging Ground",
                "address": "Amuwo-Odofin Industrial Scheme, Oshodi-Apapa Expressway",
                "city": "Lagos",
                "lng": 3.3054,
                "lat": 6.4652,
            }
        ],
        "listings": [
            {
                "ref": "mainland-laydown",
                "yard": 0,
                "asset_class": "land_staging",
                "asset_type": "Laydown",
                "photo": "laydown",
                "title": "Laydown Yard 3,500 sqm — plant parking and materials",
                "description": (
                    "Hardstanding for contractors who need somewhere to keep plant "
                    "and materials between jobs. Guarded day and night; entry logged."
                ),
                "specs": {
                    "area": 3500,
                    "fencing": "Fully fenced",
                    "access_road": "Trailer-accessible",
                    "surface_type": "Compacted laterite",
                    "weight_bearing": "Heavy plant OK",
                    "zoning": "Industrial",
                    "gradient": "Level",
                    "security": ["Fenced", "Guards 24-7", "CCTV"],
                    "utilities": ["Power", "Water"],
                },
                "daily_price": _n(88_000),
                "monthly_price": _n(1_980_000),
                "unit_count": 2,
            },
            {
                "ref": "mainland-marshalling",
                "yard": 0,
                "asset_class": "land_staging",
                "asset_type": "Marshalling",
                "photo": "marshalling",
                "title": "Truck Standing Area — 60 bays, Apapa call-up",
                "description": (
                    "Overnight truck standing for hauliers on the Apapa call-up "
                    "system. Driver facilities on site. Priced per day for the whole "
                    "block; smaller allocations by arrangement."
                ),
                "specs": {
                    "area": 9000,
                    "fencing": "Fully fenced",
                    "access_road": "Trailer-accessible",
                    "surface_type": "Gravel",
                    "weight_bearing": "Heavy plant OK",
                    "zoning": "Industrial",
                    "gradient": "Level",
                    "security": ["Fenced", "Guards 24-7"],
                    "utilities": ["Power", "Water", "Drainage"],
                },
                "daily_price": _n(150_000),
                "monthly_price": _n(3_400_000),
                "unit_count": 1,
            },
            {
                "ref": "mainland-land",
                "yard": 0,
                "asset_class": "land_staging",
                "asset_type": "Industrial Land",
                "photo": "industrial-land",
                "title": "Industrial Plot 2,500 sqm — short-let, expressway frontage",
                "description": (
                    "Smaller plot with expressway frontage, taken most often for "
                    "site offices, equipment display and temporary workshops."
                ),
                "specs": {
                    "area": 2500,
                    "fencing": "Partially",
                    "access_road": "Truck-accessible",
                    "surface_type": "Compacted laterite",
                    "weight_bearing": "Light vehicles only",
                    "zoning": "Mixed",
                    "gradient": "Slight slope",
                    "security": ["Fenced"],
                    "utilities": ["Power"],
                },
                "daily_price": _n(62_000),
                "monthly_price": _n(1_400_000),
                "unit_count": 1,
            },
        ],
    },
    {
        "slug": "sangotedo-rentals",
        "business_name": "Sangotedo Equipment Rentals Ltd",
        "contact_name": "Titilayo Ade-Johnson",
        "phone": "+2348031000116",
        "bank_name": "First City Monument Bank",
        "description": (
            "Materials-handling and access equipment for the Lekki–Ajah corridor. "
            "Short hires welcome; delivery on our own low-loader within Eti-Osa at "
            "no extra charge."
        ),
        "yards": [
            {
                "name": "Sangotedo Equipment Yard",
                "address": "Lekki-Epe Expressway, Sangotedo",
                "city": "Lagos",
                "lng": 3.6312,
                "lat": 6.4703,
            }
        ],
        "listings": [
            {
                "ref": "sangotedo-forklift3t",
                "yard": 0,
                "asset_class": "plant_machinery",
                "asset_type": "Forklift (industrial)",
                "photo": "forklift",
                "title": "3-tonne Diesel Forklift — warehouse and site",
                "description": (
                    "Workhorse 3-tonne forklift with pneumatic tyres, equally at home "
                    "on a warehouse floor and a compacted site. Operator available "
                    "at extra cost."
                ),
                "specs": {
                    "make": "Toyota",
                    "model": "8FD30",
                    "year": 2020,
                    "condition": "Good",
                    "operator_included": "Available (extra)",
                    "lift_capacity": 3,
                    "lift_height": 4.5,
                    "tyre_type": "Pneumatic",
                    "operating_weight": 4,
                    "fuel_type": "Diesel",
                    "operator_day_rate": 25000,
                },
                "daily_price": _n(58_000),
                "weekly_price": _n(348_000),
                "monthly_price": _n(1_250_000),
                "unit_count": 4,
            },
            {
                "ref": "sangotedo-forklift10t",
                "yard": 0,
                "asset_class": "plant_machinery",
                "asset_type": "Forklift (industrial)",
                "photo": "forklift",
                "title": "10-tonne Heavy Forklift — steel and machinery",
                "description": (
                    "High-capacity forklift for steel coils, machinery crates and "
                    "container stuffing. Operator included given the load class."
                ),
                "specs": {
                    "make": "Linde",
                    "model": "H100",
                    "year": 2018,
                    "condition": "Good",
                    "operator_included": "Included",
                    "lift_capacity": 10,
                    "lift_height": 5.0,
                    "tyre_type": "Solid",
                    "operating_weight": 14,
                    "fuel_type": "Diesel",
                },
                "daily_price": _n(145_000),
                "weekly_price": _n(870_000),
                "unit_count": 1,
            },
            {
                "ref": "sangotedo-boomlift",
                "yard": 0,
                "asset_class": "plant_machinery",
                "asset_type": "Boom / Scissor Lift",
                "photo": "boom-lift",
                "title": "Articulating Boom Lift 16 m — signage and maintenance",
                "description": (
                    "Articulating boom that reaches over obstacles — the usual choice "
                    "for signage, façade cleaning and estate street-light work along "
                    "the Lekki corridor."
                ),
                "specs": {
                    "make": "Haulotte",
                    "model": "HA16 RTJ",
                    "year": 2021,
                    "condition": "Excellent",
                    "operator_included": "Not available",
                    "working_height": 16,
                    "platform_capacity": 230,
                    "power": "Diesel",
                    "fuel_type": "Diesel",
                    "operating_weight": 7,
                },
                "daily_price": _n(96_000),
                "weekly_price": _n(576_000),
                "monthly_price": _n(2_080_000),
                "unit_count": 2,
            },
        ],
    },
]

# --- solo listings ---------------------------------------------------------
# Listings pinned at their own point rather than a yard, so the map shows solo
# pins alongside aggregated yard pins (search §3: <2 Live listings ⇒ solo pin).

SOLO_LISTINGS: list[dict] = [
    {
        "ref": "solo-yaba-generator",
        "supplier": "cornerstone-plant",
        "asset_class": "plant_machinery",
        "asset_type": "Generator",
        "photo": "generator",
        "title": "100 kVA Generator — Yaba, standby hire",
        "description": (
            "Single 100 kVA set kept at our Yaba sub-depot for short standby "
            "hires around the mainland. Delivered and connected the same day."
        ),
        "specs": {
            "make": "Mikano",
            "model": "MP100",
            "year": 2021,
            "condition": "Good",
            "operator_included": "Not available",
            "power_output": 100,
            "phase": "Three",
            "soundproof": True,
            "fuel_type": "Diesel",
            "operating_weight": 2,
        },
        "daily_price": _n(52_000),
        "weekly_price": _n(310_000),
        "monthly_price": _n(1_120_000),
        "unit_count": 2,
        "address": "Herbert Macaulay Way, Yaba",
        "city": "Lagos",
        "lng": 3.3792,
        "lat": 6.5095,
    },
    {
        "ref": "solo-apapa-tipper",
        "supplier": "transatlantic",
        "asset_class": "trucks_haulage",
        "asset_type": "Tipper / Dump Truck",
        "photo": "tipper",
        "title": "Tipper 15t — Coconut, short-haul spoil",
        "description": (
            "Smaller tipper stationed at Coconut for short spoil runs where a "
            "30-tonner cannot turn. Driver included."
        ),
        "specs": {
            "make": "Isuzu",
            "model": "FVZ",
            "year": 2020,
            "condition": "Good",
            "driver_included": "Included",
            "operating_range": "Lagos only",
            "payload_capacity": 15,
            "axle_config": "6×4",
            "insurance_cover": "Third-party",
        },
        "daily_price": _n(98_000),
        "weekly_price": _n(590_000),
        "unit_count": 1,
        "address": "Coconut Bus Stop, Apapa-Oshodi Expressway",
        "city": "Lagos",
        "lng": 3.3268,
        "lat": 6.4569,
    },
    {
        "ref": "solo-ibadan-excavator",
        "supplier": "sahara-earthmovers",
        "asset_class": "plant_machinery",
        "asset_type": "Excavator",
        "photo": "excavator",
        "title": "JCB JS205 Excavator — Ibadan, Oluyole",
        "description": (
            "Single machine stationed at Oluyole for Oyo State work. Operator "
            "included; mobilisation to Lagos quoted on request."
        ),
        "specs": {
            "make": "JCB",
            "model": "JS205",
            "year": 2020,
            "condition": "Good",
            "operator_included": "Included",
            "operating_weight": 20,
            "bucket_capacity": 0.9,
            "engine_power": 155,
            "fuel_type": "Diesel",
            "tracked_or_wheeled": "Tracked",
        },
        "daily_price": _n(195_000),
        "weekly_price": _n(1_170_000),
        "unit_count": 1,
        "address": "Oluyole Industrial Estate, Ibadan",
        "city": "Ibadan",
        "lng": 3.8712,
        "lat": 7.3402,
    },
    {
        "ref": "solo-benin-tipper",
        "supplier": "northgate",
        "asset_class": "trucks_haulage",
        "asset_type": "Tipper / Dump Truck",
        "photo": "tipper",
        "title": "Tipper 20t — Benin City, laterite supply",
        "description": (
            "Single tipper based in Benin City, mostly on laterite and sharp-sand "
            "supply for Edo State builders. Driver included."
        ),
        "specs": {
            "make": "Sinotruk",
            "model": "Howo",
            "year": 2019,
            "condition": "Fair",
            "driver_included": "Included",
            "operating_range": "South-West",
            "payload_capacity": 20,
            "axle_config": "6×4",
            "insurance_cover": "Third-party",
        },
        "daily_price": _n(105_000),
        "unit_count": 1,
        "address": "Ikpoba Hill, Benin City",
        "city": "Benin City",
        "lng": 5.6396,
        "lat": 6.3382,
    },
    {
        "ref": "solo-enugu-warehouse",
        "supplier": "niger-bridge",
        "asset_class": "warehousing",
        "asset_type": "Dry Warehouse",
        "photo": "dry-warehouse",
        "title": "Warehouse 700 sqm — Emene, Enugu",
        "description": (
            "Standalone warehouse on the Emene industrial layout, let monthly. "
            "Level access, single-phase power, guarded."
        ),
        "specs": {
            "security": ["Fenced", "Guards 24-7"],
            "floor_area": 700,
            "power_supply": "Single-phase",
            "truck_access": "Light truck only",
            "ceiling_height": 6,
            "loading_bays": 1,
        },
        "daily_price": _n(70_000),
        "monthly_price": _n(1_580_000),
        "unit_count": 1,
        "address": "Emene Industrial Layout, Enugu",
        "city": "Enugu",
        "lng": 7.5711,
        "lat": 6.4602,
    },
    {
        "ref": "solo-kaduna-crane",
        "supplier": "sahara-earthmovers",
        "asset_class": "plant_machinery",
        "asset_type": "Mobile Crane",
        "photo": "mobile-crane",
        "title": "Rough-Terrain Crane 25t — Kaduna",
        "description": (
            "Rough-terrain crane held at Kaduna for northern projects. Operator "
            "included; certificates current."
        ),
        "specs": {
            "make": "Tadano",
            "model": "GR-250N",
            "year": 2017,
            "condition": "Good",
            "operator_included": "Included",
            "operating_weight": 26,
            "max_lift_capacity": 25,
            "boom_length": 31,
            "crane_type": "Rough-terrain",
            "certifications": "Load test valid to Aug 2026",
        },
        "daily_price": _n(340_000),
        "weekly_price": _n(2_040_000),
        "unit_count": 1,
        "address": "Kakuri Industrial Area, Kaduna",
        "city": "Kaduna",
        "lng": 7.4165,
        "lat": 10.4806,
    },
    {
        "ref": "solo-abeokuta-land",
        "supplier": "ikorodu-park",
        "asset_class": "land_staging",
        "asset_type": "Industrial Land",
        "photo": "industrial-land",
        "title": "Industrial Land 6,000 sqm — Abeokuta, Sagamu Road",
        "description": (
            "Roadside industrial plot on the Sagamu approach to Abeokuta. Partially "
            "fenced, level, suited to laydown or a temporary plant."
        ),
        "specs": {
            "area": 6000,
            "fencing": "Partially",
            "access_road": "Trailer-accessible",
            "surface_type": "Bare earth",
            "weight_bearing": "Unverified",
            "zoning": "Industrial",
            "gradient": "Level",
            "security": ["Fenced"],
            "utilities": ["None"],
        },
        "daily_price": _n(75_000),
        "monthly_price": _n(1_690_000),
        "unit_count": 1,
        "address": "Sagamu Road, Abeokuta",
        "city": "Abeokuta",
        "lng": 3.3619,
        "lat": 7.1478,
    },
]


# --- hirers ----------------------------------------------------------------

HIRERS: list[dict] = [
    {
        "slug": "castleford",
        "name": "Adaeze Okonkwo",
        "company": "Castleford Construction Ltd",
        "phone": "+2348032000201",
    },
    {
        "slug": "rivergate",
        "name": "Tunde Bakare",
        "company": "Rivergate Civil Works Ltd",
        "phone": "+2348032000202",
    },
    {
        "slug": "summit-infra",
        "name": "Ngozi Eze",
        "company": "Summit Infrastructure Nigeria Ltd",
        "phone": "+2348032000203",
    },
    {
        "slug": "palmgrove",
        "name": "Ibrahim Danladi",
        "company": "Palmgrove Properties Ltd",
        "phone": "+2348032000204",
    },
    {
        "slug": "ashford-energy",
        "name": "Chidi Anyanwu",
        "company": "Ashford Energy Services Ltd",
        "phone": "+2348032000205",
    },
    {
        "slug": "bluecrest",
        "name": "Funmilayo Adeyemi",
        "company": "Bluecrest Logistics Ltd",
        "phone": "+2348032000206",
    },
    {
        "slug": "zenith-roadworks",
        "name": "Musa Abdullahi",
        "company": "Zenith Roadworks Ltd",
        "phone": "+2348032000207",
    },
    {
        "slug": "harmattan-agro",
        "name": "Blessing Udo",
        "company": "Harmattan Agro Processing Ltd",
        "phone": "+2348032000208",
    },
    {
        "slug": "meridian-fm",
        "name": "Yakubu Sule",
        "company": "Meridian Facilities Management Ltd",
        "phone": "+2348032000209",
    },
    {
        "slug": "oakstone",
        "name": "Kemi Ogunlesi",
        "company": "Oakstone Developments Ltd",
        "phone": "+2348032000210",
    },
    {
        "slug": "riverstone",
        "name": "Uche Nnamdi",
        "company": "Riverstone Aggregates Ltd",
        "phone": "+2348032000211",
    },
    {
        "slug": "vanguard-telecom",
        "name": "Segun Adebayo",
        "company": "Vanguard Telecoms Infrastructure Ltd",
        "phone": "+2348032000212",
    },
]


# --- hire history ----------------------------------------------------------
# ``start`` is an offset in days from the seed date; ``days`` is the inclusive
# length. ``status`` is the state the hire should end in — the seeder walks it
# there through ``hires.state.apply`` so every transition writes a real
# HireEvent and the timeline reads like genuine history.
#
# ``messages`` alternate hirer → supplier starting with the hirer, matching how
# a real enquiry opens.

HIRE_SCRIPT: list[dict] = [
    # --- completed history --------------------------------------------------
    {
        "listing": "harbourline-cat320d",
        "hirer": "castleford",
        "start": -62,
        "days": 14,
        "status": "completed",
        "note": "Bulk excavation for the Ijora warehouse foundation. Site access from 7am.",
        "messages": [
            "Good morning. We need the 320D for two weeks from the 12th — foundation dig at Ijora. Is it free?",
            "Good morning sir. Yes, the 320D is available for that window. Operator and fuel for an 8-hour shift are included.",
            "Perfect. Any issue working Saturdays?",
            "No issue. Saturday is a normal working day for us, Sunday attracts a surcharge.",
        ],
    },
    {
        "listing": "transatlantic-tipper30",
        "hirer": "riverstone",
        "start": -48,
        "days": 10,
        "status": "completed",
        "note": "Granite haulage from the Ogun quarry to our Ikorodu batching plant.",
        "messages": [
            "We need two tippers for ten days moving granite from Ogun to Ikorodu. Can you confirm both?",
            "Two units confirmed. Note that runs beyond 60 km put fuel on your account, as stated on the listing.",
            "Understood, that is fine.",
        ],
    },
    {
        "listing": "cornerstone-pump",
        "hirer": "oakstone",
        "start": -35,
        "days": 3,
        "status": "completed",
        "note": "Raft slab pour, Lekki Phase 1. Pour starts 6am, expect 180 m³.",
        "messages": [
            "Hiring the 38 m pump for a raft pour. About 180 cubes, starting 6am on the 25th.",
            "Noted. We will be on site by 5am to set up and prime. Please have the mixers arriving from 6am so we do not stand idle.",
            "Agreed, mixers are booked from our own plant.",
            "Pour completed. Thank you — pipeline washed out and we are off site.",
        ],
    },
    {
        "listing": "agbara-dc",
        "hirer": "bluecrest",
        "start": -90,
        "days": 60,
        "status": "completed",
        "note": "Peak-season regional hub for FMCG distribution.",
        "messages": [
            "We want the DC for two months over the peak season. Are the twelve docks all working?",
            "All twelve docks are operational, levellers serviced last month. Yard takes forty trailers.",
        ],
    },
    {
        "listing": "onne-forklift",
        "hirer": "ashford-energy",
        "start": -28,
        "days": 7,
        "status": "completed",
        "note": "Pipe handling during the Trans-Amadi yard turnaround.",
        "messages": [
            "Need the 7-tonne forklift for a week at Trans-Amadi. Operator included?",
            "Yes, operator is included. He knows the yard well.",
        ],
    },
    {
        "listing": "sahara-roller",
        "hirer": "zenith-roadworks",
        "start": -21,
        "days": 12,
        "status": "completed",
        "note": "Subbase compaction, Kubwa link road.",
        "messages": [
            "Two rollers for the Kubwa link road, twelve days. Confirm availability please.",
            "Both units are free from the 18th. Operators included.",
            "Good, please proceed.",
        ],
    },
    # --- on hire right now --------------------------------------------------
    {
        "listing": "oregun-crane80",
        "hirer": "summit-infra",
        "start": -4,
        "days": 9,
        "status": "on_hire",
        "note": "Structural steel erection, Oregun. Lift plan already reviewed by our engineer.",
        "messages": [
            "We are ready for the 80t crane from Monday. Our engineer has the lift plan.",
            "Received and reviewed. Ground bearing at the north-east leg needs a mat — we will bring ours.",
            "Noted, thank you.",
        ],
    },
    {
        "listing": "bluewater-depot",
        "hirer": "bluecrest",
        "start": -12,
        "days": 45,
        "status": "on_hire",
        "note": "Overflow storage while the port is congested.",
        "messages": [
            "Taking the depot for six weeks. We will need the daily stock report by email each morning.",
            "That is standard for us — report goes out by 8am daily with the tally sheet attached.",
        ],
    },
    {
        "listing": "transatlantic-truckhead",
        "hirer": "harmattan-agro",
        "start": -6,
        "days": 20,
        "status": "on_hire",
        "note": "Moving containerised sesame to the port for export.",
        "messages": [
            "Two truck heads for twenty days, Tin Can to our Ikeja packhouse and back.",
            "Confirmed, two units with drivers holding current port access passes.",
        ],
    },
    {
        "listing": "greenfield-frozen",
        "hirer": "harmattan-agro",
        "start": -18,
        "days": 90,
        "status": "on_hire",
        "note": "Frozen storage for the export season.",
        "messages": [
            "We need the frozen store for the full season. Can you hold −18 without excursions? Our buyer audits the logs.",
            "Yes. Dual compressors with automatic changeover, and the logger exports to CSV for your auditor.",
            "That is exactly what we need.",
        ],
    },
    # --- confirmed, starting soon ------------------------------------------
    {
        "listing": "lekki-containeryard",
        "hirer": "bluecrest",
        "start": 9,
        "days": 30,
        "status": "confirmed",
        "note": "Staging for the Lekki port call in March.",
        "messages": [
            "Reserving the yard for thirty days around our March vessel. Automated gate is a big plus for us.",
            "Booked. Send your haulier list ahead of time and we will pre-register the plates.",
        ],
    },
    {
        "listing": "harbourline-crane50",
        "hirer": "oakstone",
        "start": 6,
        "days": 4,
        "status": "confirmed",
        "note": "Precast panel erection at Ilupeju.",
        "messages": [
            "Four days for the 50t crane, precast panels at Ilupeju.",
            "Confirmed. Please send the panel weights so we can check the radius chart.",
            "Sending now — heaviest is 6.2 tonnes at 14 m.",
            "That works comfortably on the QY50.",
        ],
    },
    {
        "listing": "delta-pilingrig",
        "hirer": "ashford-energy",
        "start": 15,
        "days": 21,
        "status": "confirmed",
        "note": "Bored piles for the Ughelli flow station extension.",
        "messages": [
            "Three weeks on the BG 15 for bored piles at Ughelli. Can you also quote the casing oscillator?",
            "Oscillator is available — I will send a separate quote today.",
        ],
    },
    {
        "listing": "cornerstone-scissor",
        "hirer": "meridian-fm",
        "start": 3,
        "days": 14,
        "status": "confirmed",
        "note": "Ceiling and lighting works at a Victoria Island office fit-out.",
        "messages": [
            "Two electric scissor lifts for a fit-out, two weeks. Non-marking tyres confirmed?",
            "Confirmed, non-marking and fully electric — no exhaust indoors.",
        ],
    },
    {
        "listing": "agbara-dry1",
        "hirer": "palmgrove",
        "start": 20,
        "days": 60,
        "status": "confirmed",
        "note": "Storage for finishing materials ahead of handover.",
        "messages": [
            "Two months from the 20th for the 3,000 sqm unit.",
            "Reserved. Sprinkler certificate and the insurance schedule are on file if your insurer asks.",
        ],
    },
    # --- accepted, awaiting payment ----------------------------------------
    {
        "listing": "oregun-hiab",
        "hirer": "vanguard-telecom",
        "start": 5,
        "days": 6,
        "status": "accepted",
        "note": "Generator drops at six base-station sites across Lagos.",
        "messages": [
            "Six days of Hiab work, dropping generators at BTS sites. Some are tight compounds.",
            "The X-HiPro reaches 16 m so tight compounds are usually fine. Send the site list and we will check the awkward ones.",
        ],
    },
    {
        "listing": "sahara-grader",
        "hirer": "zenith-roadworks",
        "start": 11,
        "days": 8,
        "status": "accepted",
        "note": "Camber formation on the Nasarawa contract.",
        "messages": [
            "Grader needed for eight days on the Nasarawa job.",
            "Available. Our operator has worked that stretch before.",
        ],
    },
    {
        "listing": "sangotedo-forklift3t",
        "hirer": "meridian-fm",
        "start": 2,
        "days": 5,
        "status": "accepted",
        "note": "Stock move for a client relocation in Ajah.",
        "messages": [
            "One 3-tonne forklift for five days in Ajah. Do we need to take the operator?",
            "Optional — ₦25,000 a day if you want ours. Otherwise your own certified driver is fine.",
        ],
    },
    # --- requested, pending supplier decision ------------------------------
    {
        "listing": "lekki-laydown",
        "hirer": "summit-infra",
        "start": 25,
        "days": 45,
        "status": "requested",
        "note": "Staging wind-turbine sections landing at Lekki in April.",
        "messages": [
            "We have turbine sections landing in April and need laydown for about six weeks. Is the crane corridor clear on all three sides?",
        ],
    },
    {
        "listing": "ikorodu-warehouse",
        "hirer": "harmattan-agro",
        "start": 18,
        "days": 30,
        "status": "requested",
        "note": "Packaging and pallet storage for the new line.",
        "messages": [
            "Is the racking included at that price, or is it charged separately?",
        ],
    },
    {
        "listing": "northgate-boxtruck",
        "hirer": "palmgrove",
        "start": 8,
        "days": 4,
        "status": "requested",
        "note": "Moving fittings from Kano to the Abuja site.",
        "messages": [
            "Kano to Abuja, four days, one covered truck. Can the tail lift take 500 kg?",
        ],
    },
    {
        "listing": "cornerstone-mixer",
        "hirer": "castleford",
        "start": 4,
        "days": 2,
        "status": "requested",
        "note": "Two-day pour, Yaba.",
        "messages": [
            "Two mixers for a two-day pour at Yaba. Short notice, sorry — is it possible?",
        ],
    },
    # --- declined and cancelled --------------------------------------------
    {
        "listing": "oregun-towercrane",
        "hirer": "rivergate",
        "start": 30,
        "days": 90,
        "status": "declined",
        "decline_reason": "The crane is already committed to another project for that period.",
        "note": "Tower crane for the Yaba mid-rise.",
        "messages": [
            "Three months on the MC 85 for a mid-rise at Yaba, starting next month.",
            "Apologies — it is committed elsewhere for that window. I will let you know the moment it frees up.",
        ],
    },
    {
        "listing": "transatlantic-lowbed",
        "hirer": "rivergate",
        "start": 12,
        "days": 3,
        "status": "cancelled",
        "cancel_reason": "Plant movement postponed by the client.",
        "note": "Moving an excavator from Ibadan to Lagos.",
        "messages": [
            "Lowbed for three days, Ibadan to Lagos, moving a 22-tonne excavator.",
            "No problem, that is within the deck rating.",
            "Unfortunately our client has pushed the move back. We will have to cancel — sorry for the trouble.",
        ],
    },
    {
        "listing": "onne-laydown",
        "hirer": "ashford-energy",
        "start": -55,
        "days": 20,
        "status": "cancelled",
        "cancel_reason": "Rig schedule changed; the spread was demobilised early.",
        "note": "Laydown for a drilling spread.",
        "messages": [
            "Twenty days of laydown for a drilling spread arriving next week.",
            "Confirmed, the yard is clear from Monday.",
        ],
    },
    # --- in dispute ---------------------------------------------------------
    {
        "listing": "transatlantic-flatbed",
        "hirer": "riverstone",
        "start": -30,
        "days": 6,
        "status": "in_dispute",
        "dispute_reason": (
            "Truck arrived two days late and one day was lost to a breakdown; "
            "we are disputing the charge for those days."
        ),
        "note": "Steel delivery to the Ikorodu plant.",
        "messages": [
            "The flatbed did not arrive until Wednesday — we booked from Monday.",
            "I am sorry. The vehicle was held at a checkpoint on the Ibadan road. I can look at the last day.",
            "It also broke down on Thursday and we lost a full day. We are raising this with Terminal.",
        ],
    },
    # --- enquiry-only conversations (no hire yet) ---------------------------
    {
        "listing": "greenfield-chilled",
        "hirer": "harmattan-agro",
        "status": "enquiry",
        "messages": [
            "What humidity range does the chilled room hold? We are storing fresh produce for airfreight.",
            "It sits between 85 and 90 percent RH, which suits most produce. We can adjust if you tell us the commodity.",
            "Mostly green beans and chillies.",
        ],
    },
    {
        "listing": "bluewater-reachstacker",
        "hirer": "bluecrest",
        "status": "enquiry",
        "messages": [
            "If our own reach stacker goes down, how quickly could you mobilise yours to Ijora?",
            "Same day within Lagos if we have a unit free. It travels on our own lowbed.",
        ],
    },
    {
        "listing": "mainland-marshalling",
        "hirer": "bluecrest",
        "status": "enquiry",
        "messages": [
            "Can we take twenty bays rather than the whole block? We do not need sixty.",
            "Yes, we do partial allocations. Tell me the number of trucks and I will price it.",
        ],
    },
    {
        "listing": "lekki-reachstacker",
        "hirer": "summit-infra",
        "status": "enquiry",
        "messages": [
            "Is the Konecranes unit available for mobilisation outside the free zone?",
        ],
    },
    {
        "listing": "delta-generator",
        "hirer": "vanguard-telecom",
        "status": "enquiry",
        "messages": [
            "Do you deliver the 500 kVA to Port Harcourt, and is commissioning included?",
            "We deliver anywhere in the South-South. Installation and commissioning are included; fuel is on your account.",
        ],
    },
]
