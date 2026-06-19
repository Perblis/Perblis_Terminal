"""Spec template definitions — the normative seed source (doc 05 §2–§6).

Each template = class-common fields + type-specific fields. One ★ filterable
headline spec per class (doc 05 §7): operating_weight · payload_capacity ·
floor_area · container_capacity · area. Edits here flow to the DB via
``seed_spec_templates`` (idempotent upsert on class+type+version).

Field def shape: ``{kind, unit?, required, options?, filterable, display_name}``.
"""

from __future__ import annotations

from listings.enums import AssetClass

VERSION = 1

_CONDITION = ["Excellent", "Good", "Fair"]


def _f(kind, *, name, unit="", required=False, options=None, filterable=False):
    d: dict = {"kind": kind, "required": required, "filterable": filterable, "display_name": name}
    if unit:
        d["unit"] = unit
    if options is not None:
        d["options"] = options
    return d


# --- Class-common field sets ------------------------------------------------

_PLANT_COMMON = {
    "make": _f("text", name="Make", required=True),
    "model": _f("text", name="Model", required=True),
    "year": _f("number", name="Year", required=True),
    "condition": _f("select", name="Condition", required=True, options=_CONDITION),
    "operating_weight": _f("number", name="Operating weight", unit="tonnes", filterable=True),
    "engine_power": _f("number", name="Engine power", unit="hp"),
    "hours_logged": _f("number", name="Hours logged", unit="hrs"),
    "fuel_type": _f("select", name="Fuel type", options=["Diesel", "Petrol", "Electric", "Hybrid"]),
    "operator_included": _f(
        "select",
        name="Operator",
        required=True,
        options=["Included", "Available (extra)", "Not available"],
    ),
    "operator_day_rate": _f("number", name="Operator day rate", unit="₦/day"),
    "operator_experience": _f("number", name="Operator experience", unit="years"),
    "certifications": _f("text", name="Certifications"),
}

_TRUCK_COMMON = {
    "make": _f("text", name="Make", required=True),
    "model": _f("text", name="Model", required=True),
    "year": _f("number", name="Year", required=True),
    "condition": _f("select", name="Condition", required=True, options=_CONDITION),
    "payload_capacity": _f(
        "number", name="Payload capacity", unit="tonnes", required=True, filterable=True
    ),
    "driver_included": _f(
        "select",
        name="Driver",
        required=True,
        options=["Included", "Self-drive allowed", "Both options"],
    ),
    "driver_day_rate": _f("number", name="Driver day rate", unit="₦/day"),
    "insurance_cover": _f(
        "select",
        name="Insurance cover",
        options=["Comprehensive", "Third-party", "None disclosed"],
    ),
    "operating_range": _f(
        "select",
        name="Operating range",
        required=True,
        options=["Lagos only", "South-West", "Nationwide"],
    ),
    "registration_state": _f("text", name="Registration state"),
}

_WAREHOUSE_COMMON = {
    "floor_area": _f("number", name="Floor area", unit="sqm", required=True, filterable=True),
    "ceiling_height": _f("number", name="Ceiling height", unit="m", required=True),
    "loading_bays": _f("number", name="Loading bays"),
    "dock_levellers": _f("boolean", name="Dock levellers"),
    "power_supply": _f(
        "select",
        name="Power supply",
        required=True,
        options=["None", "Single-phase", "Three-phase"],
    ),
    "backup_power": _f("boolean", name="Backup power"),
    "security": _f(
        "multi",
        name="Security",
        required=True,
        options=["Fenced", "CCTV", "Guards 24-7", "Access control"],
    ),
    "fire_safety": _f(
        "multi",
        name="Fire safety",
        options=["Extinguishers", "Hydrants", "Sprinklers", "Alarms"],
    ),
    "floor_load_capacity": _f("number", name="Floor load capacity", unit="t/sqm"),
    "office_space": _f("boolean", name="Office space"),
    "truck_access": _f(
        "select",
        name="Truck access",
        required=True,
        options=["Trailer-accessible", "Light truck only"],
    ),
    "condition_notes": _f("text", name="Condition notes"),
}

_TERMINAL_COMMON = {
    "total_area": _f("number", name="Total area", unit="sqm", required=True),
    "container_capacity": _f(
        "number", name="Container capacity", unit="TEU", required=True, filterable=True
    ),
    "surface_type": _f(
        "select",
        name="Surface type",
        required=True,
        options=["Concrete", "Interlocked", "Asphalt", "Compacted laterite"],
    ),
    "weighbridge": _f("boolean", name="Weighbridge"),
    "reefer_plugs": _f("number", name="Reefer plugs"),
    "gate_system": _f(
        "select", name="Gate system", options=["Manual", "Automated", "Gate + tally"]
    ),
    "customs_status": _f(
        "select",
        name="Customs status",
        required=True,
        options=["Bonded", "ICD-licensed", "Non-bonded"],
    ),
    "handling_equipment": _f(
        "multi",
        name="Handling equipment",
        required=True,
        options=["Reach stacker", "Forklift", "Empty handler", "Crane", "None — hirer brings own"],
    ),
    "operating_hours": _f(
        "select", name="Operating hours", required=True, options=["24-7", "Day shift", "Custom"]
    ),
    "port_distance": _f("number", name="Port distance", unit="km"),
    "rail_access": _f("boolean", name="Rail access"),
}

_LAND_COMMON = {
    "area": _f("number", name="Area", unit="sqm", required=True, filterable=True),
    "surface_type": _f(
        "select",
        name="Surface type",
        required=True,
        options=["Concrete", "Tarmac", "Compacted laterite", "Gravel", "Bare earth"],
    ),
    "weight_bearing": _f(
        "select",
        name="Weight bearing",
        required=True,
        options=["Heavy plant OK", "Light vehicles only", "Unverified"],
    ),
    "fencing": _f(
        "select", name="Fencing", required=True, options=["Fully fenced", "Partially", "Open"]
    ),
    "security": _f("multi", name="Security", options=["Guards", "CCTV", "Lighting", "None"]),
    "access_road": _f(
        "select",
        name="Access road",
        required=True,
        options=["Trailer-accessible", "Truck-accessible", "Car only"],
    ),
    "utilities": _f("multi", name="Utilities", options=["Power", "Water", "Drainage", "None"]),
    "zoning": _f(
        "select", name="Zoning", options=["Industrial", "Commercial", "Mixed", "Undetermined"]
    ),
    "gradient": _f("select", name="Gradient", options=["Level", "Slight slope", "Sloped"]),
    "condition_notes": _f("text", name="Condition notes"),
}

# --- Type-specific field sets per class -------------------------------------

_PLANT_TYPES = {
    "Excavator": {
        "bucket_capacity": _f("number", name="Bucket capacity", unit="m³"),
        "max_dig_depth": _f("number", name="Max dig depth", unit="m"),
        "boom_config": _f("select", name="Boom config", options=["Standard", "Long-reach"]),
        "tracked_or_wheeled": _f(
            "select", name="Tracked or wheeled", options=["Tracked", "Wheeled"]
        ),
    },
    "Bulldozer": {
        "blade_type": _f("select", name="Blade type", options=["Straight", "Universal", "Angle"]),
        "blade_width": _f("number", name="Blade width", unit="m"),
        "ripper": _f("boolean", name="Ripper"),
    },
    "Wheel Loader / Backhoe": {
        "bucket_capacity": _f("number", name="Bucket capacity", unit="m³"),
        "lift_capacity": _f("number", name="Lift capacity", unit="t"),
    },
    "Grader": {
        "blade_width": _f("number", name="Blade width", unit="m"),
    },
    "Roller / Compactor": {
        "drum_width": _f("number", name="Drum width", unit="m"),
        "drum_type": _f("select", name="Drum type", options=["Smooth", "Padfoot"]),
        "vibratory": _f("boolean", name="Vibratory"),
    },
    "Mobile Crane": {
        "max_lift_capacity": _f("number", name="Max lift capacity", unit="t"),
        "boom_length": _f("number", name="Boom length", unit="m"),
        "jib_length": _f("number", name="Jib length", unit="m"),
        "crane_type": _f(
            "select",
            name="Crane type",
            options=["Truck-mounted", "Rough-terrain", "All-terrain", "Crawler"],
        ),
    },
    "Tower Crane": {
        "max_lift_capacity": _f("number", name="Max lift capacity", unit="t"),
        "jib_length": _f("number", name="Jib length", unit="m"),
        "max_height": _f("number", name="Max height", unit="m"),
    },
    "Boom / Scissor Lift": {
        "working_height": _f("number", name="Working height", unit="m"),
        "platform_capacity": _f("number", name="Platform capacity", unit="kg"),
        "power": _f("select", name="Power", options=["Diesel", "Electric"]),
    },
    "Forklift (industrial)": {
        "lift_capacity": _f("number", name="Lift capacity", unit="t"),
        "lift_height": _f("number", name="Lift height", unit="m"),
        "tyre_type": _f("select", name="Tyre type", options=["Pneumatic", "Solid"]),
    },
    "Concrete Mixer (transit)": {
        "drum_capacity": _f("number", name="Drum capacity", unit="m³"),
    },
    "Concrete Pump": {
        "output": _f("number", name="Output", unit="m³/h"),
        "boom_reach": _f("number", name="Boom reach", unit="m"),
        "pump_type": _f("select", name="Pump type", options=["Boom", "Line"]),
    },
    "Generator": {
        "power_output": _f("number", name="Power output", unit="kVA"),
        "phase": _f("select", name="Phase", options=["Single", "Three"]),
        "soundproof": _f("boolean", name="Soundproof"),
        "fuel_consumption": _f("number", name="Fuel consumption", unit="l/h"),
    },
    "Air Compressor": {
        "air_delivery": _f("number", name="Air delivery", unit="cfm"),
        "pressure": _f("number", name="Pressure", unit="bar"),
    },
    "Drilling Rig": {
        "max_drill_depth": _f("number", name="Max drill depth", unit="m"),
        "drill_diameter": _f("number", name="Drill diameter", unit="mm"),
        "rig_type": _f("select", name="Rig type", options=["Rotary", "DTH", "Piling"]),
    },
    "Welding Machine": {
        "output": _f("number", name="Output", unit="amps"),
        "power_source": _f("select", name="Power source", options=["Diesel", "Electric"]),
    },
}

_TRUCK_TYPES = {
    "Tipper / Dump Truck": {
        "bucket_capacity": _f("number", name="Bucket capacity", unit="m³"),
        "axle_config": _f(
            "select", name="Axle config", options=["6×4", "8×4", "10-tyre", "12-tyre"]
        ),
    },
    "Flatbed Truck": {
        "deck_length": _f("number", name="Deck length", unit="m"),
        "deck_width": _f("number", name="Deck width", unit="m"),
    },
    "Box / Covered Truck": {
        "cargo_volume": _f("number", name="Cargo volume", unit="m³"),
        "tail_lift": _f("boolean", name="Tail lift"),
    },
    "Lowbed / Lowboy Trailer": {
        "deck_length": _f("number", name="Deck length", unit="m"),
        "max_load": _f("number", name="Max load", unit="t"),
        "ramps": _f("boolean", name="Ramps"),
    },
    "Fuel / Chemical Tanker": {
        "tank_capacity": _f("number", name="Tank capacity", unit="litres"),
        "compartments": _f("number", name="Compartments"),
        "product_class": _f(
            "select",
            name="Product class",
            options=["PMS-AGO", "Water", "Chemical", "Food-grade"],
        ),
    },
    "Water Bowser": {
        "tank_capacity": _f("number", name="Tank capacity", unit="litres"),
        "pump": _f("boolean", name="Pump"),
    },
    "Crane Truck (Hiab)": {
        "crane_capacity": _f("number", name="Crane capacity", unit="t"),
        "crane_reach": _f("number", name="Crane reach", unit="m"),
    },
    "Reach Stacker / Container Handler": {
        "lift_capacity": _f("number", name="Lift capacity", unit="t"),
        "stacking_height": _f("number", name="Stacking height", unit="containers"),
        "container_sizes": _f("multi", name="Container sizes", options=["20ft", "40ft", "45ft"]),
    },
    "Truck Head (tractor unit)": {
        "horse_power": _f("number", name="Horse power", unit="hp"),
        "axle_config": _f("select", name="Axle config", options=["4×2", "6×4", "8×4"]),
    },
}

_WAREHOUSE_TYPES = {
    "Dry Warehouse": {
        "racking_installed": _f("boolean", name="Racking installed"),
        "pallet_positions": _f("number", name="Pallet positions"),
    },
    "Cold Storage": {
        "temperature_range": _f(
            "select",
            name="Temperature range",
            options=["Chilled 0–8°C", "Frozen −18°C", "Blast"],
        ),
        "cold_capacity": _f("number", name="Cold capacity", unit="sqm"),
        "temperature_monitoring": _f("boolean", name="Temperature monitoring"),
    },
    "Bonded Warehouse": {
        "customs_licence_status": _f(
            "select", name="Customs licence status", options=["Active", "Pending"]
        ),
        "licence_expiry": _f("text", name="Licence expiry"),
    },
    "Distribution Centre": {
        "dock_doors": _f("number", name="Dock doors"),
        "yard_space": _f("boolean", name="Yard space"),
        "cross_dock": _f("boolean", name="Cross dock"),
    },
    "Self-Storage Unit": {
        "unit_size": _f("number", name="Unit size", unit="sqm"),
        "climate_controlled": _f("boolean", name="Climate controlled"),
        "access_hours": _f("select", name="Access hours", options=["24-7", "Business hours"]),
    },
}

_TERMINAL_TYPES = {
    "Port Terminal": {
        "berth_access": _f("boolean", name="Berth access"),
        "max_vessel_draft": _f("number", name="Max vessel draft", unit="m"),
    },
    "ICD": {
        "customs_examination_area": _f("boolean", name="Customs examination area"),
    },
    "Container Yard / Bonded Depot": {},
}

_LAND_TYPES = {
    "Fabrication Yard": {
        "covered_area": _f("number", name="Covered area", unit="sqm"),
        "gantry_crane": _f("boolean", name="Gantry crane"),
        "gantry_crane_capacity": _f("number", name="Gantry crane capacity", unit="t"),
    },
    "Laydown": {},
    "Marshalling": {},
    "Industrial Land": {},
}

_CLASSES = [
    (AssetClass.PLANT_MACHINERY, _PLANT_COMMON, _PLANT_TYPES),
    (AssetClass.TRUCKS_HAULAGE, _TRUCK_COMMON, _TRUCK_TYPES),
    (AssetClass.WAREHOUSING, _WAREHOUSE_COMMON, _WAREHOUSE_TYPES),
    (AssetClass.TERMINALS_YARDS, _TERMINAL_COMMON, _TERMINAL_TYPES),
    (AssetClass.LAND_STAGING, _LAND_COMMON, _LAND_TYPES),
]


def build_templates() -> list[dict]:
    """The launch spec-template set (~36): class-common + type-specific fields."""
    templates: list[dict] = []
    for asset_class, common, types in _CLASSES:
        for asset_type, specific in types.items():
            templates.append(
                {
                    "asset_class": str(asset_class),
                    "asset_type": asset_type,
                    "version": VERSION,
                    "fields": {**common, **specific},
                }
            )
    return templates


# The single ★ filterable headline spec per class (doc 05 §7) — the field the
# map/list search ``spec_min/max`` range filter targets for the active class.
# Derived from the class-common field sets so it stays the one source of truth.
_STAR_FIELDS: dict[str, str | None] = {
    str(asset_class): next((name for name, fdef in common.items() if fdef.get("filterable")), None)
    for asset_class, common, _ in _CLASSES
}


def star_field(asset_class: str) -> str | None:
    """The ★ filterable spec field name for a class (None if unknown)."""
    return _STAR_FIELDS.get(asset_class)
