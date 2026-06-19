"""Payments API views — the Bachs webhook receiver (TSD §3.6, D-017)."""

from __future__ import annotations

import json

import structlog
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from . import bachs, services
from .tasks import process_collection_event

logger = structlog.get_logger(__name__)


class PaymentWebhookView(APIView):
    """Receive Bachs webhooks: verify the signature, dedup, 200 fast, process async.

    The signature is HMAC-SHA256 over the raw body; a hire is only ever marked
    paid by the async processor after re-verifying the charge with Bachs — never
    from this request, and never from a client redirect.
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
        if not bachs.verify_signature(
            timestamp=request.headers.get("X-Bachs-Timestamp"),
            raw_body=raw,
            signature=request.headers.get("X-Bachs-Signature"),
        ):
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

        event_id = envelope.get("id")
        event_type = envelope.get("type", "")
        if not event_id:
            return Response(
                {"error": {"code": "invalid_payload", "message": "Missing event id."}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        created = services.record_event(event_id=event_id, event_type=event_type, payload=envelope)
        if not created:
            return Response({"status": "duplicate"}, status=status.HTTP_200_OK)

        # 200 fast; the charge is verified and the hire confirmed off-request.
        process_collection_event.enqueue(event_id)
        return Response({"status": "accepted"}, status=status.HTTP_200_OK)
