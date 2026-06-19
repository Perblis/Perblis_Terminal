"""Search API views (thin; aggregation lives in search.services)."""

from __future__ import annotations

from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.generics import GenericAPIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from search import pagination
from search import serializers as s
from search.services.aggregation import search_map
from search.services.listing import search_list


class MapSearchView(GenericAPIView):
    """Server-aggregated yards + solo listings for a viewport/radius (TSD §3.7).

    Anonymous access is allowed (guest browsing, FSD §6); throttled at the
    ``search_anon`` rate (60/min).
    """

    permission_classes = [AllowAny]
    throttle_scope = "search_anon"
    serializer_class = s.MapSearchParamsSerializer

    @extend_schema(
        parameters=[
            OpenApiParameter(
                "bbox",
                str,
                description="Viewport 'min_lng,min_lat,max_lng,max_lat'. Provide this OR lat+lng+radius_km.",
            ),
            OpenApiParameter("lat", float, description="Reference latitude (radius mode)."),
            OpenApiParameter("lng", float, description="Reference longitude (radius mode)."),
            OpenApiParameter(
                "radius_km", float, description="One of 5/10/25/50/100 or a custom value."
            ),
            OpenApiParameter("asset_class", str, description="Filter to one asset class."),
            OpenApiParameter(
                "q", str, description="Case-insensitive match on title + description."
            ),
            OpenApiParameter("price_min", int, description="Daily price floor (kobo)."),
            OpenApiParameter("price_max", int, description="Daily price ceiling (kobo)."),
            OpenApiParameter(
                "spec_min", float, description="Floor for the class ★ spec; requires asset_class."
            ),
            OpenApiParameter("spec_max", float, description="Ceiling for the class ★ spec."),
        ],
        responses={200: s.MapResponseSerializer},
    )
    def get(self, request):
        params = self.get_serializer(data=request.query_params)
        params.is_valid(raise_exception=True)
        return Response(search_map(params.validated_data))


class ListSearchView(GenericAPIView):
    """The map result set as a distance-ordered, cursor-paginated list (TSD §3.2).

    ``group_by=asset`` (default) → flat listings with ``more_at_yard``;
    ``group_by=location`` → yard cards interleaved with solo listings.
    Anonymous access; ``search_anon`` throttle (60/min).
    """

    permission_classes = [AllowAny]
    throttle_scope = "search_anon"
    serializer_class = s.ListSearchParamsSerializer

    @extend_schema(
        parameters=[
            OpenApiParameter(
                "bbox",
                str,
                description="Viewport 'min_lng,min_lat,max_lng,max_lat'. Provide this OR lat+lng+radius_km.",
            ),
            OpenApiParameter("lat", float, description="Reference latitude (radius mode)."),
            OpenApiParameter("lng", float, description="Reference longitude (radius mode)."),
            OpenApiParameter("radius_km", float, description="One of 5/10/25/50/100 or custom."),
            OpenApiParameter("asset_class", str, description="Filter to one asset class."),
            OpenApiParameter(
                "q", str, description="Case-insensitive match on title + description."
            ),
            OpenApiParameter("price_min", int, description="Daily price floor (kobo)."),
            OpenApiParameter("price_max", int, description="Daily price ceiling (kobo)."),
            OpenApiParameter("spec_min", float, description="Floor for the class ★ spec."),
            OpenApiParameter("spec_max", float, description="Ceiling for the class ★ spec."),
            OpenApiParameter("group_by", str, description="'asset' (default) or 'location'."),
            OpenApiParameter("cursor", str, description="Opaque keyset pagination cursor."),
            OpenApiParameter("page_size", int, description="Items per page (≤100, default 20)."),
        ],
        responses={200: s.ListResponseSerializer},
    )
    def get(self, request):
        params = self.get_serializer(data=request.query_params)
        params.is_valid(raise_exception=True)
        group_by = params.validated_data.get("group_by", "asset")
        items = search_list(params.validated_data, group_by)
        return Response(pagination.paginate(items, request))
