"""Suppliers API views.

Thin handlers: validate input, call exactly one service, shape the response.
All mutation lives in ``suppliers.services.*``.
"""

from __future__ import annotations

from rest_framework import status
from rest_framework.generics import GenericAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.permissions import IsSupplier
from suppliers import serializers as s
from suppliers.services import profile as profile_service
from suppliers.services import yards as yards_service


class SupplierProfileView(GenericAPIView):
    permission_classes = [IsAuthenticated, IsSupplier]
    serializer_class = s.SupplierProfileSerializer

    def get(self, request):
        profile = profile_service.get_or_create_profile(request.user)
        return Response(self.get_serializer(profile).data)

    def patch(self, request):
        profile = profile_service.get_or_create_profile(request.user)
        data = self.get_serializer(profile, data=request.data, partial=True)
        data.is_valid(raise_exception=True)
        updated = profile_service.update_profile(user=request.user, **data.validated_data)
        return Response(self.get_serializer(updated).data)


class YardListCreateView(GenericAPIView):
    permission_classes = [IsAuthenticated, IsSupplier]
    serializer_class = s.YardSerializer

    def get(self, request):
        page = self.paginate_queryset(yards_service.list_yards(request.user))
        return self.get_paginated_response(self.get_serializer(page, many=True).data)

    def post(self, request):
        data = self.get_serializer(data=request.data)
        data.is_valid(raise_exception=True)
        v = data.validated_data
        yard = yards_service.create_yard(
            user=request.user,
            name=v["name"],
            point=v["point"],
            address_text=v.get("address_text", ""),
            city=v.get("city", ""),
        )
        return Response(self.get_serializer(yard).data, status=status.HTTP_201_CREATED)


class YardDetailView(GenericAPIView):
    permission_classes = [IsAuthenticated, IsSupplier]
    serializer_class = s.YardSerializer

    def patch(self, request, yard_id):
        yard = yards_service.get_yard(user=request.user, yard_id=yard_id)
        data = self.get_serializer(yard, data=request.data, partial=True)
        data.is_valid(raise_exception=True)
        updated = yards_service.update_yard(
            user=request.user, yard_id=yard_id, **data.validated_data
        )
        return Response(self.get_serializer(updated).data)

    def delete(self, request, yard_id):
        yards_service.delete_yard(user=request.user, yard_id=yard_id)
        return Response(status=status.HTTP_204_NO_CONTENT)
