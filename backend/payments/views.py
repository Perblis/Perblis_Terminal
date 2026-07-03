"""Payments API views — the provider webhook receiver (TSD §3.6, D-018)."""

from __future__ import annotations

import json

import structlog
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.generics import GenericAPIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import IsSupplier

from . import gateway, serializers, services
from .tasks import process_collection_event

logger = structlog.get_logger(__name__)


class PaymentWebhookView(APIView):
    """Receive provider webhooks: verify the signature, dedup, 200 fast, process async.

    The signature scheme is the active provider's (Paystack: HMAC-SHA512 of the
    raw body). A hire is only ever marked paid by the async processor after
    re-verifying the charge with the provider — never from this request, and
    never from a client redirect.
    """

    permission_classes = [AllowAny]
    authentication_classes: list = []

    @extend_schema(
        request=None,
        responses={
            200: OpenApiResponse(description="Accepted (or duplicate — idempotent)."),
            400: OpenApiResponse(description="Signature could not be verified."),
        },
    )
    def post(self, request):
        raw = request.body
        if not gateway.verify_signature(headers=request.headers, raw_body=raw):
            return Response(
                {"error": {"code": "invalid_webhook_signature", "message": "Bad signature."}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            envelope = json.loads(raw)
        except json.JSONDecodeError:
            return Response(
                {"error": {"code": "invalid_payload", "message": "Malformed JSON."}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        event = gateway.parse_webhook(envelope)
        if not event.valid or not event.dedup_id:
            return Response(
                {"error": {"code": "invalid_payload", "message": "Missing event id."}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        created = services.record_event(
            event_id=event.dedup_id, event_type=event.event_type, payload=envelope
        )
        if not created:
            return Response({"status": "duplicate"}, status=status.HTTP_200_OK)

        # 200 fast; the charge is verified and the hire confirmed off-request.
        process_collection_event.enqueue(event.dedup_id)
        return Response({"status": "accepted"}, status=status.HTTP_200_OK)


class SupplierPayoutListView(GenericAPIView):
    """The supplier's payouts + the payout-strip summary (Wave 7 P2/F11).

    Cursor-paginated rows with a ``summary`` block on the envelope (mirrors the
    messaging list's ``unread_total``). Supplier-only: payout figures are
    supplier-confidential (D-014), and this is their one API home.
    """

    permission_classes = [IsAuthenticated, IsSupplier]
    serializer_class = serializers.PayoutSerializer

    @extend_schema(responses={200: serializers.PayoutSerializer(many=True)})
    def get(self, request):
        payouts = services.list_payouts(supplier=request.user)
        page = self.paginate_queryset(payouts)
        response = self.get_paginated_response(self.get_serializer(page, many=True).data)
        response.data["summary"] = services.payout_summary(supplier=request.user)
        return response
