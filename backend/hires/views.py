"""Hires API views (thin; all mutation lives in hires.services)."""

from __future__ import annotations

from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.generics import GenericAPIView
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from rest_framework.response import Response

from core.money import display
from core.permissions import IsHirer, IsSupplier
from hires import serializers as s
from hires import services
from payments.serializers import PaymentStatusSerializer


class HireListCreateView(GenericAPIView):
    """``GET`` the caller's hires (filterable by role/status); ``POST`` a request."""

    permission_classes = [IsAuthenticated]
    serializer_class = s.HireSerializer

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsAuthenticated(), IsHirer()]
        return [IsAuthenticated()]

    @extend_schema(
        parameters=[
            OpenApiParameter("role", str, required=False, enum=["hirer", "supplier"]),
            OpenApiParameter("status", str, required=False),
            OpenApiParameter(
                "from",
                str,
                required=False,
                description="Only hires overlapping on/after this date (YYYY-MM-DD).",
            ),
            OpenApiParameter(
                "to",
                str,
                required=False,
                description="Only hires overlapping on/before this date (YYYY-MM-DD).",
            ),
        ],
        responses={200: s.HireSerializer(many=True)},
    )
    def get(self, request):
        window = s.HireWindowSerializer(
            data={
                "start": request.query_params.get("from"),
                "end": request.query_params.get("to"),
            }
        )
        window.is_valid(raise_exception=True)
        hires = services.list_hires(
            user=request.user,
            role=request.query_params.get("role"),
            status=request.query_params.get("status"),
            **window.validated_data,
        )
        page = self.paginate_queryset(hires)
        return self.get_paginated_response(self.get_serializer(page, many=True).data)

    @extend_schema(request=s.HireCreateSerializer, responses={201: s.HireDetailSerializer})
    def post(self, request):
        data = s.HireCreateSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        payload = dict(data.validated_data)
        payload.pop("terms_accepted", None)
        hire = services.create_hire(user=request.user, **payload)
        body = s.HireDetailSerializer(hire, context={"request": request}).data
        return Response(body, status=status.HTTP_201_CREATED)


class HireDetailView(GenericAPIView):
    serializer_class = s.HireDetailSerializer
    permission_classes = [IsAuthenticated]

    def get(self, request, hire_id):
        hire = services.get_hire(user=request.user, hire_id=hire_id)
        return Response(self.get_serializer(hire).data)


class HireAcceptView(GenericAPIView):
    serializer_class = s.HireDetailSerializer
    permission_classes = [IsAuthenticated]

    @extend_schema(request=s.HireAcceptSerializer, responses={200: s.HireDetailSerializer})
    def post(self, request, hire_id):
        data = s.HireAcceptSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        hire = services.accept_hire(
            user=request.user,
            hire_id=hire_id,
            acknowledgments=data.validated_data["acknowledgments"],
        )
        return Response(self.get_serializer(hire).data)


class HireDeclineView(GenericAPIView):
    serializer_class = s.HireDetailSerializer
    permission_classes = [IsAuthenticated]

    @extend_schema(request=s.HireDeclineSerializer, responses={200: s.HireDetailSerializer})
    def post(self, request, hire_id):
        data = s.HireDeclineSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        hire = services.decline_hire(
            user=request.user, hire_id=hire_id, reason=data.validated_data["reason"]
        )
        return Response(self.get_serializer(hire).data)


class HireCancelView(GenericAPIView):
    serializer_class = s.HireDetailSerializer
    permission_classes = [IsAuthenticated]

    @extend_schema(request=s.HireCancelSerializer, responses={200: s.HireDetailSerializer})
    def post(self, request, hire_id):
        data = s.HireCancelSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        hire = services.cancel_hire(
            user=request.user, hire_id=hire_id, reason=data.validated_data["reason"]
        )
        return Response(self.get_serializer(hire).data)


class HirePaymentView(GenericAPIView):
    """Checkout status + authorization_url for a hire (D-017)."""

    permission_classes = [IsAuthenticated]
    serializer_class = PaymentStatusSerializer

    def get(self, request, hire_id):
        from hires.enums import HireStatus
        from payments.errors import NoPayment
        from payments.services import initialize_payment, latest_payment

        hire = services.get_hire(user=request.user, hire_id=hire_id)
        payment = latest_payment(hire)
        if payment is None and hire.status == HireStatus.ACCEPTED:
            # Recovery: checkout init runs post-commit; retry if the Bachs call failed.
            from payments.errors import CheckoutUnavailable

            try:
                payment = initialize_payment(hire)
            except CheckoutUnavailable:
                raise
        if payment is None:
            raise NoPayment()
        return Response(self.get_serializer(payment).data)


class HireHandoverView(GenericAPIView):
    """Submit an on-hire / off-hire handover record (FSD §7.4)."""

    permission_classes = [IsAuthenticated]
    serializer_class = s.HandoverSerializer

    @extend_schema(request=s.HandoverCreateSerializer, responses={201: s.HandoverSerializer})
    def post(self, request, hire_id):
        data = s.HandoverCreateSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        handover = services.submit_handover(
            user=request.user, hire_id=hire_id, **data.validated_data
        )
        return Response(self.get_serializer(handover).data, status=status.HTTP_201_CREATED)


class HandoverConfirmView(GenericAPIView):
    """The counterparty confirms a handover, advancing the hire."""

    permission_classes = [IsAuthenticated]
    serializer_class = s.HandoverSerializer

    def post(self, request, handover_id):
        handover = services.confirm_handover(user=request.user, handover_id=handover_id)
        return Response(self.get_serializer(handover).data)


class HireDisputeView(GenericAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = s.HireDetailSerializer

    @extend_schema(request=s.DisputeSerializer, responses={200: s.HireDetailSerializer})
    def post(self, request, hire_id):
        data = s.DisputeSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        hire = services.raise_dispute(
            user=request.user, hire_id=hire_id, reason=data.validated_data["reason"]
        )
        return Response(self.get_serializer(hire).data)


class HireRefundPreviewView(GenericAPIView):
    """The §7.6 refund manifest if the caller cancelled now (Wave 7, read-only).

    The portal renders these figures verbatim — money is never recomputed
    client-side. 400 ``refund_not_applicable`` unless the hire is Confirmed.
    """

    permission_classes = [IsAuthenticated]
    serializer_class = s.RefundPreviewSerializer

    @extend_schema(responses={200: s.RefundPreviewSerializer})
    def get(self, request, hire_id):
        hire, cancelled_by, plan = services.refund_preview(user=request.user, hire_id=hire_id)
        processing = hire.hire_value - plan.amount - plan.withheld_day
        return Response(
            {
                "cancelled_by": cancelled_by,
                "kind": plan.kind,
                "hire_value": hire.hire_value,
                "hire_value_display": display(hire.hire_value),
                "amount": plan.amount,
                "amount_display": display(plan.amount),
                "withheld_day": plan.withheld_day,
                "withheld_day_display": display(plan.withheld_day),
                "processing": processing,
                "processing_display": display(processing),
                "strike": plan.strike,
            }
        )


class HireStatsView(GenericAPIView):
    """Supplier dashboard counts (Wave 7 P2) — by-status totals + nearest expiry."""

    permission_classes = [IsAuthenticated, IsSupplier]
    serializer_class = s.HireStatsSerializer

    @extend_schema(
        parameters=[OpenApiParameter("role", str, required=False, enum=["supplier"])],
        responses={200: s.HireStatsSerializer},
    )
    def get(self, request):
        return Response(services.hire_stats(user=request.user))


class HireEventsView(GenericAPIView):
    """The supplier's cross-hire activity feed (Wave 7 P2), cursor-paginated."""

    permission_classes = [IsAuthenticated, IsSupplier]
    serializer_class = s.HireEventFeedSerializer

    @extend_schema(responses={200: s.HireEventFeedSerializer(many=True)})
    def get(self, request):
        events = services.list_hire_events(user=request.user)
        page = self.paginate_queryset(events)
        return self.get_paginated_response(self.get_serializer(page, many=True).data)


class HireResolveDisputeView(GenericAPIView):
    """Ops resolves a dispute (Wave 6 gives this a console; the API exists now)."""

    permission_classes = [IsAuthenticated, IsAdminUser]
    serializer_class = s.HireDetailSerializer

    @extend_schema(request=s.ResolveDisputeSerializer, responses={200: s.HireDetailSerializer})
    def post(self, request, hire_id):
        data = s.ResolveDisputeSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        hire = services.resolve_dispute(user=request.user, hire_id=hire_id, **data.validated_data)
        return Response(self.get_serializer(hire).data)
