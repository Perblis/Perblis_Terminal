"""Request/response shapes for the listings API."""

from __future__ import annotations

from rest_framework import serializers
from rest_framework_gis.fields import GeometryField

from core import media
from core.money import display
from listings.enums import AssetClass
from listings.models import Listing, ListingPhoto, SpecTemplate, Unit


class SpecTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = SpecTemplate
        fields = ["asset_class", "asset_type", "version", "fields"]
        read_only_fields = fields


class UnitSerializer(serializers.ModelSerializer):
    class Meta:
        model = Unit
        fields = ["id", "label"]
        read_only_fields = ["id"]


class ListingPhotoSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()

    class Meta:
        model = ListingPhoto
        fields = ["id", "r2_key", "url", "position", "is_cover"]
        read_only_fields = ["id", "url", "position"]

    def get_url(self, obj: ListingPhoto) -> str:
        return media.public_url(obj.r2_key)


class PhotoAttachSerializer(serializers.Serializer):
    r2_key = serializers.CharField(max_length=255)
    is_cover = serializers.BooleanField(default=False)


class _PhotoOrderItem(serializers.Serializer):
    id = serializers.UUIDField()
    position = serializers.IntegerField(min_value=0)
    is_cover = serializers.BooleanField(default=False)


class PhotoReorderSerializer(serializers.Serializer):
    photos = _PhotoOrderItem(many=True, allow_empty=False)


class DuplicateSerializer(serializers.Serializer):
    copy_photos = serializers.BooleanField(default=False)


class ListingCreateSerializer(serializers.Serializer):
    asset_class = serializers.ChoiceField(choices=AssetClass.choices)
    asset_type = serializers.CharField(max_length=100)
    title = serializers.CharField(max_length=120)
    description = serializers.CharField(min_length=50)
    specs = serializers.DictField(required=False, default=dict)
    daily_price = serializers.IntegerField(min_value=1)  # integer kobo
    weekly_price = serializers.IntegerField(min_value=1, required=False, allow_null=True)
    monthly_price = serializers.IntegerField(min_value=1, required=False, allow_null=True)
    unit_count = serializers.IntegerField(min_value=1, default=1)
    yard_id = serializers.UUIDField(required=False, allow_null=True)
    point = GeometryField(required=False, allow_null=True)
    address_text = serializers.CharField(
        max_length=300, required=False, allow_blank=True, default=""
    )
    city = serializers.CharField(max_length=120, required=False, allow_blank=True, default="")
    unit_labels = serializers.ListField(
        child=serializers.CharField(max_length=120), required=False, default=list
    )


class ListingUpdateSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=120, required=False)
    description = serializers.CharField(min_length=50, required=False)
    specs = serializers.DictField(required=False)
    daily_price = serializers.IntegerField(min_value=1, required=False)
    weekly_price = serializers.IntegerField(min_value=1, required=False, allow_null=True)
    monthly_price = serializers.IntegerField(min_value=1, required=False, allow_null=True)
    unit_count = serializers.IntegerField(min_value=1, required=False)
    yard_id = serializers.UUIDField(required=False, allow_null=True)
    point = GeometryField(required=False, allow_null=True)
    address_text = serializers.CharField(max_length=300, required=False, allow_blank=True)
    city = serializers.CharField(max_length=120, required=False, allow_blank=True)


def _naira_display(kobo: int | None) -> str | None:
    return display(kobo) if kobo is not None else None


class ListingSerializer(serializers.ModelSerializer):
    point = GeometryField()
    units = UnitSerializer(many=True, read_only=True)
    photos = ListingPhotoSerializer(many=True, read_only=True)
    daily_price_display = serializers.SerializerMethodField()
    weekly_price_display = serializers.SerializerMethodField()
    monthly_price_display = serializers.SerializerMethodField()

    class Meta:
        model = Listing
        fields = [
            "id",
            "supplier_id",
            "yard_id",
            "asset_class",
            "asset_type",
            "title",
            "description",
            "specs",
            "spec_template_version",
            "daily_price",
            "weekly_price",
            "monthly_price",
            "daily_price_display",
            "weekly_price_display",
            "monthly_price_display",
            "unit_count",
            "units",
            "photos",
            "point",
            "address_text",
            "city",
            "status",
            "tier",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def get_daily_price_display(self, obj: Listing) -> str | None:
        return _naira_display(obj.daily_price)

    def get_weekly_price_display(self, obj: Listing) -> str | None:
        return _naira_display(obj.weekly_price)

    def get_monthly_price_display(self, obj: Listing) -> str | None:
        return _naira_display(obj.monthly_price)
