"""Suppliers API views.

Thin handlers: validate input, call exactly one service, shape the response.
All mutation lives in ``suppliers.services.*``.
"""

from __future__ import annotations

from rest_framework.generics import GenericAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.permissions import IsSupplier
from suppliers import serializers as s
from suppliers.services import profile as profile_service


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
