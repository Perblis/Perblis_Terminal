"""Payment serializers."""

from __future__ import annotations

from rest_framework import serializers

from .models import Payment


class PaymentStatusSerializer(serializers.ModelSerializer):
    """The hirer's view of where checkout stands (status + authorization_url)."""

    class Meta:
        model = Payment
        fields = ("reference", "state", "authorization_url", "attempt", "paid_at")
