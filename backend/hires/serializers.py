"""Hire serializers — role-shaped to honour D-014.

The service fee and supplier payout are **supplier-confidential** (D-014): they
must never appear on any hirer-facing surface. ``HireSerializer`` carries every
field, then drops the fee/payout fields unless the requester is the hire's
supplier or staff. The drop is enforced here and tested in both directions.
"""

from __future__ import annotations

from rest_framework import serializers

from core import media
from core.money import display

from .enums import CancelledBy, HandoverKind
from .models import HandoverRecord, Hire, HireEvent

# Fields visible only to the supplier (and Ops/staff) — never to the hirer.
_SUPPLIER_ONLY = ("service_fee", "service_fee_display", "payout_amount", "fee_basis")


class HireCreateSerializer(serializers.Serializer):
    listing_id = serializers.UUIDField()
    start_date = serializers.DateField()
    end_date = serializers.DateField()
    hirer_note = serializers.CharField(required=False, allow_blank=True, default="")
    # The hirer must acknowledge the terms to request (FSD §7.1).
    terms_accepted = serializers.BooleanField()

    def validate_terms_accepted(self, value: bool) -> bool:
        if not value:
            raise serializers.ValidationError("You must accept the terms to request a hire.")
        return value

    def validate(self, attrs: dict) -> dict:
        if attrs["end_date"] < attrs["start_date"]:
            raise serializers.ValidationError({"end_date": "Must be on or after start_date."})
        return attrs


class HireWindowSerializer(serializers.Serializer):
    """Optional date-window filters on the hire list (`from`/`to` query params)."""

    start = serializers.DateField(required=False, allow_null=True, default=None)
    end = serializers.DateField(required=False, allow_null=True, default=None)


class HireDeclineSerializer(serializers.Serializer):
    reason = serializers.CharField()


class HireCancelSerializer(serializers.Serializer):
    reason = serializers.CharField(required=False, allow_blank=True, default="")


class HireAcceptSerializer(serializers.Serializer):
    # Operator/driver acknowledgments where applicable (FSD §7.2); free-form.
    acknowledgments = serializers.DictField(required=False, default=dict)


class HireEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = HireEvent
        fields = ("id", "actor_kind", "from_status", "to_status", "meta", "created_at")


class HireSerializer(serializers.ModelSerializer):
    """List/summary shape. Fee fields are stripped for the hirer (D-014)."""

    listing_id = serializers.UUIDField(source="listing.id", read_only=True)
    listing_title = serializers.CharField(source="listing.title", read_only=True)
    asset_class = serializers.CharField(source="listing.asset_class", read_only=True)
    yard_id = serializers.SerializerMethodField()
    listing_photo = serializers.SerializerMethodField()
    hire_value_display = serializers.SerializerMethodField()
    service_fee_display = serializers.SerializerMethodField()
    payout_amount_display = serializers.SerializerMethodField()

    class Meta:
        model = Hire
        fields: tuple[str, ...] = (
            "id",
            "listing_id",
            "listing_title",
            "asset_class",
            "yard_id",
            "listing_photo",
            "start_date",
            "end_date",
            "duration_days",
            "scheme",
            "status",
            "hire_value",
            "hire_value_display",
            "service_fee",
            "service_fee_display",
            "payout_amount",
            "payout_amount_display",
            "fee_basis",
            "cancelled_by",
            "decline_reason",
            "cancel_reason",
            "hirer_note",
            "request_expires_at",
            "payment_deadline",
            "created_at",
        )

    def get_yard_id(self, obj: Hire) -> str | None:
        return str(obj.yard_id) if obj.yard_id else None

    def get_listing_photo(self, obj: Hire) -> str | None:
        # Cover (or first) listing photo; the view prefetches listing__photos.
        photos = list(obj.listing.photos.all())
        if not photos:
            return None
        cover = next((p for p in photos if p.is_cover), photos[0])
        return media.public_url(cover.r2_key)

    def get_hire_value_display(self, obj: Hire) -> str:
        return display(obj.hire_value)

    def get_service_fee_display(self, obj: Hire) -> str:
        return display(obj.service_fee)

    def get_payout_amount_display(self, obj: Hire) -> str:
        return display(obj.payout_amount)

    def _is_supplier_view(self, obj: Hire) -> bool:
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if user is None or not user.is_authenticated:
            return False
        return bool(user.is_staff or user.id == obj.supplier_id)

    def to_representation(self, obj: Hire) -> dict:
        data = super().to_representation(obj)
        if not self._is_supplier_view(obj):
            for field in _SUPPLIER_ONLY + ("payout_amount_display",):
                data.pop(field, None)
        return data


class HireDetailSerializer(HireSerializer):
    """Detail shape: adds the append-only event timeline."""

    events = HireEventSerializer(many=True, read_only=True)

    class Meta(HireSerializer.Meta):
        fields = (*HireSerializer.Meta.fields, "events")


class HandoverCreateSerializer(serializers.Serializer):
    kind = serializers.ChoiceField(choices=HandoverKind.choices)
    # Private-bucket object keys (uploaded via the presign pipeline); ≥2 (FSD §7.4).
    photos = serializers.ListField(child=serializers.CharField(), min_length=2)
    reading = serializers.DictField(required=False, default=dict)


class HandoverSerializer(serializers.ModelSerializer):
    class Meta:
        model = HandoverRecord
        fields = ("id", "hire", "kind", "photos", "reading", "confirmed_at", "created_at")


class RefundPreviewSerializer(serializers.Serializer):
    """The §7.6 outcome if the caller cancelled now (response-only, Wave 7).

    Every figure is server-computed integer kobo with its display string — the
    portal renders these verbatim and never recomputes (architecture invariant).
    """

    cancelled_by = serializers.ChoiceField(choices=CancelledBy.choices, read_only=True)
    kind = serializers.CharField(read_only=True)
    hire_value = serializers.IntegerField(read_only=True)
    hire_value_display = serializers.CharField(read_only=True)
    amount = serializers.IntegerField(read_only=True)
    amount_display = serializers.CharField(read_only=True)
    withheld_day = serializers.IntegerField(read_only=True)
    withheld_day_display = serializers.CharField(read_only=True)
    processing = serializers.IntegerField(read_only=True)
    processing_display = serializers.CharField(read_only=True)
    strike = serializers.BooleanField(read_only=True)


class HireStatsSerializer(serializers.Serializer):
    """Supplier dashboard counts (response-only, Wave 7 P2)."""

    by_status = serializers.DictField(child=serializers.IntegerField(), read_only=True)
    needs_response = serializers.IntegerField(read_only=True)
    nearest_request_expires_at = serializers.DateTimeField(read_only=True, allow_null=True)


class HireEventFeedSerializer(HireEventSerializer):
    """A cross-hire event row for the supplier's activity feed (Wave 7 P2)."""

    hire_id = serializers.UUIDField(read_only=True)
    listing_title = serializers.CharField(source="hire.listing.title", read_only=True)
    status = serializers.CharField(source="hire.status", read_only=True)

    class Meta(HireEventSerializer.Meta):
        fields = (*HireEventSerializer.Meta.fields, "hire_id", "listing_title", "status")


class DisputeSerializer(serializers.Serializer):
    reason = serializers.CharField()


class ResolveDisputeSerializer(serializers.Serializer):
    outcome = serializers.ChoiceField(choices=["complete", "cancel"])
    reason = serializers.CharField(required=False, allow_blank=True, default="")
