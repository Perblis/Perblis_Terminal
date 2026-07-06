"""Payment serializers."""

from __future__ import annotations

from rest_framework import serializers

from .models import Payment, Payout


class PaymentStatusSerializer(serializers.ModelSerializer):
    """The hirer's view of where checkout stands (status + authorization_url)."""

    class Meta:
        model = Payment
        fields = ("reference", "state", "authorization_url", "attempt", "paid_at")


class PayoutSerializer(serializers.ModelSerializer):
    """A supplier's payout row (Wave 7 P2/F11). Supplier-scoped by the view."""

    hire_id = serializers.UUIDField(read_only=True)
    listing_title = serializers.CharField(source="hire.listing.title", read_only=True)
    amount_display = serializers.CharField(read_only=True)

    class Meta:
        model = Payout
        fields = (
            "id",
            "hire_id",
            "listing_title",
            "amount",
            "amount_display",
            "kind",
            "state",
            "paid_ref",
            "paid_at",
            "frozen_reason",
            "created_at",
        )


class PayoutLastPaidSerializer(serializers.Serializer):
    amount = serializers.IntegerField(read_only=True)
    amount_display = serializers.CharField(read_only=True)
    paid_ref = serializers.CharField(read_only=True)
    paid_at = serializers.DateTimeField(read_only=True)


class PayoutSummarySerializer(serializers.Serializer):
    """The payout-strip summary block (server-computed money, D-014-safe:
    payout figures are supplier-confidential and this endpoint is supplier-only)."""

    queued_total = serializers.IntegerField(read_only=True)
    queued_total_display = serializers.CharField(read_only=True)
    frozen_total = serializers.IntegerField(read_only=True)
    frozen_total_display = serializers.CharField(read_only=True)
    earned_this_month = serializers.IntegerField(read_only=True)
    earned_this_month_display = serializers.CharField(read_only=True)
    earned_prev_month = serializers.IntegerField(read_only=True)
    earned_prev_month_display = serializers.CharField(read_only=True)
    last_paid = PayoutLastPaidSerializer(read_only=True, allow_null=True)
