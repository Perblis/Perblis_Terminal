from django.contrib.gis.geos import Point
from django.contrib.gis.db.models.functions import Distance
from django.contrib.gis.measure import D
from django.db.models import Q
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status

from listings.models import Listing, ResourceType
from .serializers import MapSearchResultSerializer


@api_view(['GET'])
@permission_classes([AllowAny])
def map_search(request):
    """
    Search for active listings within a radius of the given coordinates.

    Query params:
        lat (float, required): User latitude
        lng (float, required): User longitude
        radius (int, optional): Search radius in km. Default: 50. Max: 500.
        resource_type (str, optional): Filter by resource type.
        available (bool, optional): Filter by availability. Default: true.
    """
    lat = request.query_params.get('lat')
    lng = request.query_params.get('lng')

    if not lat or not lng:
        return Response(
            {'success': False, 'errors': 'lat and lng query parameters are required.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        lat = float(lat)
        lng = float(lng)
    except ValueError:
        return Response(
            {'success': False, 'errors': 'lat and lng must be valid numbers.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if not (-90 <= lat <= 90) or not (-180 <= lng <= 180):
        return Response(
            {'success': False, 'errors': 'Invalid coordinates.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        radius_km = min(int(request.query_params.get('radius', 50)), 500)
    except ValueError:
        radius_km = 50

    # Accept both 'q' (our convention) and 'search' (DRF SearchFilter convention)
    # so the mobile client can send either without another backend change.
    q = (request.query_params.get('q') or request.query_params.get('search') or '').strip()

    resource_type = request.query_params.get('resource_type')
    available_param = request.query_params.get('available', 'true').lower()
    filter_available = available_param == 'true'

    user_location = Point(lng, lat, srid=4326)

    queryset = Listing.objects.filter(
        status='active',
        location__isnull=False,
    ).select_related('owner').prefetch_related('media')

    if filter_available:
        queryset = queryset.filter(is_available=True)

    if resource_type:
        valid_types = [choice[0] for choice in ResourceType.choices]
        if resource_type not in valid_types:
            return Response(
                {'success': False, 'errors': f"Invalid resource_type. Valid values: {valid_types}"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        queryset = queryset.filter(resource_type=resource_type)

    if q:
        queryset = queryset.filter(
            Q(title__icontains=q) |
            Q(category__icontains=q) |
            Q(location_city__icontains=q)
        )

    queryset = (
        queryset
        .filter(location__distance_lte=(user_location, D(km=radius_km)))
        .annotate(distance=Distance('location', user_location))
        .order_by('distance')
    )

    serializer = MapSearchResultSerializer(
        queryset,
        many=True,
        context={'request': request},
    )

    return Response({
        'success': True,
        'count': queryset.count(),
        'radius_km': radius_km,
        'q': q or None,
        'data': serializer.data,
    })
