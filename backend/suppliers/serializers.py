"""Request/response shapes for the suppliers API.

The bank account number is **write-only in / masked out**: clients submit it as
``bank_account_number`` (10-digit NUBAN) and only ever read back the masked
``bank_account_number_masked`` (``****1234``). Plaintext never leaves the API.
"""

from __future__ import annotations

from rest_framework import serializers
from rest_framework_gis.fields import GeometryField

from core import media
from suppliers.models import SupplierProfile, Yard


class SupplierProfileSerializer(serializers.ModelSerializer):
    bank_account_number = serializers.RegexField(
        r"^\d{10}$", write_only=True, required=False, allow_blank=True
    )
    bank_account_number_masked = serializers.CharField(
        source="masked_bank_account_number", read_only=True
    )
    is_complete = serializers.BooleanField(read_only=True)
    logo_url = serializers.SerializerMethodField()

    class Meta:
        model = SupplierProfile
        fields = [
            "id",
            "business_name",
            "description",
            "logo_key",
            "logo_url",
            "bank_name",
            "bank_account_number",
            "bank_account_number_masked",
            "bank_account_name",
            "notif_hire_requests",
            "notif_messages",
            "notif_payouts",
            "notif_marketing",
            "strike_count",
            "is_complete",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "strike_count", "created_at", "updated_at"]

    def get_logo_url(self, obj: SupplierProfile) -> str:
        return media.public_url(obj.logo_key)


class YardSerializer(serializers.ModelSerializer):
    # GeoJSON in/out: {"type": "Point", "coordinates": [lng, lat]}.
    point = GeometryField()

    class Meta:
        model = Yard
        fields = ["id", "name", "point", "address_text", "city", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]
