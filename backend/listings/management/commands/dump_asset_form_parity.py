"""Dump the asset-form validation parity table (Wave 7 TSD §8).

Runs a fixed case table through ``ListingCreateSerializer`` and writes the
outcomes to ``backend/openapi/fixtures/asset-form-parity.json``. The portal's
vitest replays the same payloads through its zod asset-form schema and asserts
identical accept/reject per field — the zod↔DRF parity gate.

Regenerate whenever the listing create contract changes (part of the
OpenAPI-regen ritual) and commit the result.
"""

from __future__ import annotations

import json
from pathlib import Path

from django.core.management.base import BaseCommand

from listings.serializers import ListingCreateSerializer

FIXTURE_PATH = Path(__file__).resolve().parents[3] / "openapi" / "fixtures"

_VALID = {
    "asset_class": "plant_machinery",
    "asset_type": "Excavator",
    "title": "CAT 320D Excavator",
    "description": "Well-maintained CAT 320D excavator, 1200 hours, with certified operator.",
    "daily_price": 8_000_000,
}


def _case(name: str, overrides: dict, *, drop: tuple[str, ...] = ()) -> dict:
    payload = {k: v for k, v in {**_VALID, **overrides}.items() if k not in drop}
    return {"name": name, "payload": payload}


CASES = [
    _case("valid_minimal", {}),
    _case(
        "valid_full",
        {
            "weekly_price": 40_000_000,
            "monthly_price": 120_000_000,
            "unit_count": 3,
            "specs": {"operating_weight_t": 20},
            "address_text": "Apapa Industrial Estate",
            "city": "Lagos",
            "unit_labels": ["Unit A", "Unit B", "Unit C"],
        },
    ),
    _case("missing_asset_class", {}, drop=("asset_class",)),
    _case("invalid_asset_class", {"asset_class": "helicopters"}),
    _case("missing_title", {}, drop=("title",)),
    _case("title_too_long", {"title": "X" * 121}),
    _case("title_blank", {"title": ""}),
    _case("description_too_short", {"description": "Too short."}),
    _case("missing_description", {}, drop=("description",)),
    _case("missing_daily_price", {}, drop=("daily_price",)),
    _case("daily_price_zero", {"daily_price": 0}),
    _case("daily_price_negative", {"daily_price": -100}),
    _case("weekly_price_zero", {"weekly_price": 0}),
    _case("unit_count_zero", {"unit_count": 0}),
    _case("yard_id_not_uuid", {"yard_id": "not-a-uuid"}),
    _case("unit_label_too_long", {"unit_labels": ["Y" * 121]}),
]


def _error_codes(errors: dict) -> dict[str, list[str]]:
    return {
        field: sorted({getattr(e, "code", "invalid") for e in details})
        for field, details in errors.items()
    }


class Command(BaseCommand):
    help = "Write the zod↔DRF asset-form parity fixture (openapi/fixtures/)."

    def handle(self, *args, **options):
        results = []
        for case in CASES:
            serializer = ListingCreateSerializer(data=case["payload"])
            valid = serializer.is_valid()
            results.append(
                {
                    "name": case["name"],
                    "payload": case["payload"],
                    "valid": valid,
                    "errors": {} if valid else _error_codes(serializer.errors),
                }
            )

        FIXTURE_PATH.mkdir(parents=True, exist_ok=True)
        out = FIXTURE_PATH / "asset-form-parity.json"
        out.write_text(
            json.dumps(
                {"serializer": "listings.ListingCreateSerializer", "cases": results},
                indent=2,
                ensure_ascii=False,
            )
            + "\n",
            encoding="utf-8",
        )
        self.stdout.write(f"Wrote {len(results)} cases to {out}")
