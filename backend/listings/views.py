"""Listings API views (thin; mutation lives in listings.services.*)."""

from __future__ import annotations

from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.generics import GenericAPIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from core.permissions import IsHirer, IsSupplier
from listings import serializers as s
from listings.services import listings as listings_service
from listings.services import photos as photos_service
from listings.services import reports as reports_service
from listings.services import specs as specs_service
from listings.services import storefront as storefront_service


class SpecTemplateView(GenericAPIView):
    """Public read of a spec template by class + type (latest version default)."""

    permission_classes = [AllowAny]
    serializer_class = s.SpecTemplateSerializer

    @extend_schema(
        parameters=[
            OpenApiParameter("class", str, required=True),
            OpenApiParameter("type", str, required=True),
            OpenApiParameter("version", int, required=False),
        ],
        responses={200: s.SpecTemplateSerializer},
    )
    def get(self, request):
        asset_class = request.query_params.get("class", "")
        asset_type = request.query_params.get("type", "")
        version = request.query_params.get("version")
        template = specs_service.get_template(
            asset_class, asset_type, int(version) if version else None
        )
        if template is None:
            return Response(
                {"error": {"code": "not_found", "message": "No such spec template."}}, status=404
            )
        return Response(self.get_serializer(template).data)


class ListingListCreateView(GenericAPIView):
    permission_classes = [IsAuthenticated, IsSupplier]
    serializer_class = s.ListingSerializer

    def get(self, request):
        page = self.paginate_queryset(listings_service.list_listings(request.user))
        return self.get_paginated_response(self.get_serializer(page, many=True).data)

    @extend_schema(request=s.ListingCreateSerializer, responses={201: s.ListingSerializer})
    def post(self, request):
        data = s.ListingCreateSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        listing, suggestion = listings_service.create_listing(
            user=request.user, **data.validated_data
        )
        body = self.get_serializer(listing).data
        if suggestion is not None:
            body["yard_suggestion"] = {"id": str(suggestion.id), "name": suggestion.name}
        return Response(body, status=status.HTTP_201_CREATED)


class ListingDetailView(GenericAPIView):
    serializer_class = s.ListingSerializer

    def get_permissions(self):
        # A Live listing is publicly readable; mutation is supplier-only.
        if self.request.method == "GET":
            return [AllowAny()]
        return [IsAuthenticated(), IsSupplier()]

    def get(self, request, listing_id):
        user = request.user if request.user.is_authenticated else None
        listing = listings_service.get_listing_for_view(listing_id=listing_id, user=user)
        return Response(self.get_serializer(listing).data)

    @extend_schema(request=s.ListingUpdateSerializer, responses={200: s.ListingSerializer})
    def patch(self, request, listing_id):
        data = s.ListingUpdateSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        listing = listings_service.update_listing(
            user=request.user, listing_id=listing_id, **data.validated_data
        )
        return Response(self.get_serializer(listing).data)


class ListingPhotoView(GenericAPIView):
    permission_classes = [IsAuthenticated, IsSupplier]
    serializer_class = s.PhotoAttachSerializer

    @extend_schema(responses={201: s.ListingPhotoSerializer})
    def post(self, request, listing_id):
        data = self.get_serializer(data=request.data)
        data.is_valid(raise_exception=True)
        photo = photos_service.attach_photo(
            user=request.user, listing_id=listing_id, **data.validated_data
        )
        return Response(s.ListingPhotoSerializer(photo).data, status=status.HTTP_201_CREATED)


class ListingPhotoDetailView(GenericAPIView):
    permission_classes = [IsAuthenticated, IsSupplier]

    @extend_schema(responses={204: None})
    def delete(self, request, listing_id, photo_id):
        photos_service.delete_photo(user=request.user, listing_id=listing_id, photo_id=photo_id)
        return Response(status=status.HTTP_204_NO_CONTENT)


class ListingPhotoReorderView(GenericAPIView):
    permission_classes = [IsAuthenticated, IsSupplier]
    serializer_class = s.PhotoReorderSerializer

    @extend_schema(responses={200: s.ListingPhotoSerializer(many=True)})
    def patch(self, request, listing_id):
        data = self.get_serializer(data=request.data)
        data.is_valid(raise_exception=True)
        photos = photos_service.reorder_photos(
            user=request.user, listing_id=listing_id, items=data.validated_data["photos"]
        )
        return Response(s.ListingPhotoSerializer(photos, many=True).data)


class _ListingActionView(GenericAPIView):
    """Base for the status-action endpoints (publish / pause / archive)."""

    permission_classes = [IsAuthenticated, IsSupplier]
    serializer_class = s.ListingSerializer
    action = ""

    @extend_schema(request=None, responses={200: s.ListingSerializer})
    def post(self, request, listing_id):
        listing = listings_service.transition(
            user=request.user, listing_id=listing_id, action=self.action
        )
        return Response(self.get_serializer(listing).data)


class ListingPublishView(_ListingActionView):
    action = "publish"


class ListingPauseView(_ListingActionView):
    action = "pause"


class ListingArchiveView(_ListingActionView):
    action = "archive"


class ListingDuplicateView(GenericAPIView):
    permission_classes = [IsAuthenticated, IsSupplier]
    serializer_class = s.DuplicateSerializer

    @extend_schema(responses={201: s.ListingSerializer})
    def post(self, request, listing_id):
        data = self.get_serializer(data=request.data)
        data.is_valid(raise_exception=True)
        listing = listings_service.duplicate_listing(
            user=request.user, listing_id=listing_id, copy_photos=data.validated_data["copy_photos"]
        )
        return Response(s.ListingSerializer(listing).data, status=status.HTTP_201_CREATED)


class ListingReportView(GenericAPIView):
    permission_classes = [IsAuthenticated, IsHirer]
    serializer_class = s.ReportCreateSerializer
    throttle_scope = "report"  # 5/day/user (settings DEFAULT_THROTTLE_RATES)

    @extend_schema(responses={201: s.ReportSerializer})
    def post(self, request, listing_id):
        data = self.get_serializer(data=request.data)
        data.is_valid(raise_exception=True)
        report = reports_service.create_report(
            user=request.user, listing_id=listing_id, **data.validated_data
        )
        return Response(s.ReportSerializer(report).data, status=status.HTTP_201_CREATED)


class StorefrontView(GenericAPIView):
    """Public supplier company page (no auth, no hire CTA, no fee fields)."""

    permission_classes = [AllowAny]

    @extend_schema(responses={200: None})
    def get(self, request, supplier_id):
        return Response(storefront_service.get_storefront(supplier_id=supplier_id))
