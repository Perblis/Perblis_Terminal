"""Hires API views (thin; all mutation lives in hires.services)."""

from __future__ import annotations

from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.generics import GenericAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.permissions import IsHirer
from hires import serializers as s
from hires import services


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
        ],
        responses={200: s.HireSerializer(many=True)},
    )
    def get(self, request):
        hires = services.list_hires(
            user=request.user,
            role=request.query_params.get("role"),
            status=request.query_params.get("status"),
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
