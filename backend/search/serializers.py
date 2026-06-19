"""Request/response shapes for the search API (TSD §3.7).

The map view assembles plain dicts in ``search.services.aggregation``; the
response serializers here exist to document the frozen contract in the OpenAPI
schema (drf-spectacular reads them via ``@extend_schema``). The params
serializer additionally validates the query string.
"""

from __future__ import annotations

from rest_framework import serializers

from listings.enums import AssetClass


class MapSearchParamsSerializer(serializers.Serializer):
    """Validates the ``/search/map`` query string (bbox XOR radius)."""

    bbox = serializers.CharField(
        required=False,
        help_text="Viewport as 'min_lng,min_lat,max_lng,max_lat'. Provide this OR lat+lng+radius_km.",
    )
    lat = serializers.FloatField(required=False, min_value=-90, max_value=90)
    lng = serializers.FloatField(required=False, min_value=-180, max_value=180)
    radius_km = serializers.FloatField(
        required=False,
        min_value=0.1,
        max_value=500,
        help_text="One of 5/10/25/50/100 (standard chips) or a custom value.",
    )
    asset_class = serializers.ChoiceField(choices=AssetClass.choices, required=False)
    q = serializers.CharField(
        required=False, allow_blank=True, help_text="Case-insensitive match on title + description."
    )
    price_min = serializers.IntegerField(
        required=False, min_value=0, help_text="Daily price floor, integer kobo."
    )
    price_max = serializers.IntegerField(required=False, min_value=0)
    spec_min = serializers.FloatField(
        required=False, help_text="Floor for the class ★ headline spec; requires asset_class."
    )
    spec_max = serializers.FloatField(required=False)

    def validate_bbox(self, value: str) -> list[float]:
        parts = value.split(",")
        if len(parts) != 4:
            raise serializers.ValidationError("Expected 'min_lng,min_lat,max_lng,max_lat'.")
        try:
            nums = [float(p) for p in parts]
        except ValueError as exc:
            raise serializers.ValidationError("All four bbox values must be numbers.") from exc
        min_lng, min_lat, max_lng, max_lat = nums
        if min_lng >= max_lng or min_lat >= max_lat:
            raise serializers.ValidationError("min must be less than max on both axes.")
        return nums

    def validate(self, attrs: dict) -> dict:
        has_bbox = "bbox" in attrs
        has_radius = (
            attrs.get("lat") is not None
            and attrs.get("lng") is not None
            and attrs.get("radius_km") is not None
        )
        if has_bbox == has_radius:  # neither, or both
            raise serializers.ValidationError(
                "Provide either bbox or all of lat, lng and radius_km (not both)."
            )
        if (
            attrs.get("spec_min") is not None or attrs.get("spec_max") is not None
        ) and not attrs.get("asset_class"):
            raise serializers.ValidationError(
                "spec_min/spec_max require asset_class (the ★ field is per class)."
            )
        return attrs


# --- Response (documentation) shapes ---------------------------------------


class MapSupplierSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    name = serializers.CharField(allow_blank=True)
    logo = serializers.CharField(allow_blank=True)
    badge = serializers.CharField(allow_null=True)


class MapYardListingSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    title = serializers.CharField()
    asset_class = serializers.CharField()
    price_from = serializers.IntegerField(help_text="Cheapest daily price, integer kobo.")
    price_from_display = serializers.CharField()
    photo = serializers.CharField(allow_blank=True)
    available = serializers.BooleanField(
        help_text="True iff a unit is free for hire now (TSD §3.4)."
    )


class MapYardSerializer(serializers.Serializer):
    yard_id = serializers.UUIDField()
    name = serializers.CharField()
    point = serializers.JSONField(help_text="GeoJSON Point.")
    supplier = MapSupplierSerializer()
    listing_count = serializers.IntegerField(help_text="Live listings at the yard (in view).")
    matching_count = serializers.IntegerField(help_text="Of those, how many pass the filters.")
    class_mix = serializers.ListField(child=serializers.CharField())
    price_from = serializers.IntegerField(help_text="Cheapest daily price at the yard, kobo.")
    price_from_display = serializers.CharField()
    listings = MapYardListingSerializer(many=True)


class MapSoloListingSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    title = serializers.CharField()
    asset_class = serializers.CharField()
    point = serializers.JSONField(help_text="GeoJSON Point.")
    price_from = serializers.IntegerField(help_text="Daily price, integer kobo.")
    price_from_display = serializers.CharField()
    distance_km = serializers.FloatField(help_text="Distance from the reference point, 0.1 km.")
    photo = serializers.CharField(allow_blank=True)
    badge = serializers.CharField(help_text="Listing trust tier (basic/verified/inspected).")
    available = serializers.BooleanField(
        help_text="True iff a unit is free for hire now (TSD §3.4)."
    )


class MapResponseSerializer(serializers.Serializer):
    yards = MapYardSerializer(many=True)
    listings = MapSoloListingSerializer(many=True)


# --- List endpoint ---------------------------------------------------------


class ListSearchParamsSerializer(MapSearchParamsSerializer):
    """Map params + the list grouping. Pagination uses ``cursor``/``page_size``."""

    group_by = serializers.ChoiceField(
        choices=["asset", "location"],
        required=False,
        default="asset",
        help_text="asset = flat listings (with more_at_yard); location = yard cards + solos.",
    )


class ListAssetItemSerializer(MapSoloListingSerializer):
    yard_id = serializers.UUIDField(allow_null=True)
    more_at_yard = serializers.IntegerField(
        help_text="Other matching listings at the same yard ('+N more at this yard')."
    )


class ListLocationYardSerializer(MapYardSerializer):
    type = serializers.CharField(help_text="Always 'yard'.")
    distance_km = serializers.FloatField(help_text="Distance to the nearest listing, 0.1 km.")
    # ``matching_count`` doesn't apply to a filtered list card; listing_count is
    # the matching count here.
    matching_count = None  # type: ignore[assignment]


class ListLocationListingSerializer(MapSoloListingSerializer):
    type = serializers.CharField(help_text="Always 'listing'.")
    yard_id = serializers.UUIDField(allow_null=True)


class ListResponseSerializer(serializers.Serializer):
    next = serializers.URLField(allow_null=True)
    previous = serializers.URLField(allow_null=True)
    results = serializers.ListField(
        child=serializers.DictField(),
        help_text="asset mode → ListAssetItem[]; location mode → yard cards + listings.",
    )


# --- Geocode proxy ---------------------------------------------------------


class GeocodeParamsSerializer(serializers.Serializer):
    q = serializers.CharField(min_length=2, help_text="Free-text place / address query.")
    limit = serializers.IntegerField(required=False, min_value=1, max_value=10, default=5)


class GeocodeResultSerializer(serializers.Serializer):
    display_name = serializers.CharField()
    lat = serializers.FloatField()
    lng = serializers.FloatField()


class GeocodeResponseSerializer(serializers.Serializer):
    query = serializers.CharField()
    provider_configured = serializers.BooleanField(
        help_text="False when LOCATIONIQ_KEY is unset (dev/CI) — results will be empty."
    )
    results = GeocodeResultSerializer(many=True)
