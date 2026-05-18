from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import IsAuthenticated, IsAuthenticatedOrReadOnly
from rest_framework.response import Response

from core.file_urls import absolute_file_field
from core.pagination import StandardPagination

from .filters import ListingFilter
from .models import Listing, ListingMedia, ListingReport
from .serializers import (
    ListingSerializer,
    CreateListingSerializer,
    UpdateListingStatusSerializer,
    ListingReportSerializer,
)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def listing_list_create(request):
    """
    GET: Return the authenticated owner's own listings with filtering,
         ordering, and pagination.
    POST: Create a new listing (owner role required).
    """
    if request.method == 'GET':
        queryset = Listing.objects.filter(
            owner=request.user
        ).prefetch_related('media').order_by('-created_at')

        filterset = ListingFilter(request.query_params, queryset=queryset)
        if not filterset.is_valid():
            return Response(
                {'success': False, 'errors': filterset.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )
        queryset = filterset.qs

        ordering = request.query_params.get('ordering', '-created_at')
        allowed_orderings = [
            'created_at', '-created_at',
            'view_count', '-view_count',
            'price_daily', '-price_daily',
            'title', '-title',
        ]
        if ordering in allowed_orderings:
            queryset = queryset.order_by(ordering)

        paginator = StandardPagination()
        page = paginator.paginate_queryset(queryset, request)
        serializer = ListingSerializer(page, many=True, context={'request': request})
        return paginator.get_paginated_response(serializer.data)

    if not request.user.is_owner:
        return Response(
            {'success': False, 'errors': 'You must enable the owner role to create listings.'},
            status=status.HTTP_403_FORBIDDEN,
        )

    serializer = CreateListingSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    listing = serializer.save(owner=request.user)

    return Response(
        {'success': True, 'data': ListingSerializer(listing, context={'request': request}).data},
        status=status.HTTP_201_CREATED,
    )


@api_view(['GET', 'PUT', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticatedOrReadOnly])
def listing_detail(request, listing_id):
    """
    GET: Public listing detail (increments view count).
    PUT/PATCH: Update listing (owner only).
    DELETE: Archive listing (owner only).
    """
    listing = get_object_or_404(Listing.objects.prefetch_related('media', 'owner'), id=listing_id)

    if request.method == 'GET':
        Listing.objects.filter(id=listing_id).update(view_count=listing.view_count + 1)
        listing.refresh_from_db(fields=['view_count'])
        serializer = ListingSerializer(listing, context={'request': request})
        return Response({'success': True, 'data': serializer.data})

    if listing.owner != request.user:
        return Response(
            {'success': False, 'errors': 'You do not have permission to modify this listing.'},
            status=status.HTTP_403_FORBIDDEN,
        )

    if request.method in ['PUT', 'PATCH']:
        serializer = CreateListingSerializer(
            listing, data=request.data, partial=(request.method == 'PATCH')
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({
            'success': True,
            'data': ListingSerializer(listing, context={'request': request}).data,
        })

    if request.method == 'DELETE':
        listing.status = 'archived'
        listing.save(update_fields=['status'])
        return Response({'success': True, 'message': 'Listing archived.'})


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def listing_status(request, listing_id):
    """Update listing status (publish, pause, archive)."""
    listing = get_object_or_404(Listing, id=listing_id, owner=request.user)

    serializer = UpdateListingStatusSerializer(listing, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    serializer.save()

    return Response({
        'success': True,
        'message': f"Listing status updated to '{listing.status}'.",
        'data': {'status': listing.status},
    })


MAX_LISTING_PHOTOS = 10


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def upload_media(request, listing_id):
    """Upload a photo to a listing. Owner only. Maximum 10 photos per listing."""
    listing = get_object_or_404(Listing, id=listing_id)
    if listing.owner != request.user:
        return Response(
            {'success': False, 'errors': 'You do not have permission to upload to this listing.'},
            status=status.HTTP_403_FORBIDDEN,
        )

    if 'file' not in request.FILES:
        return Response(
            {'success': False, 'errors': 'No file provided.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    current_count = listing.media.count()
    if current_count >= MAX_LISTING_PHOTOS:
        return Response(
            {
                'success': False,
                'errors': f'Maximum {MAX_LISTING_PHOTOS} photos per listing. '
                          f'Delete an existing photo before uploading a new one.',
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    media_file = request.FILES['file']
    is_primary = request.data.get('is_primary', 'false').lower() == 'true'

    if not listing.media.exists():
        is_primary = True

    media = ListingMedia.objects.create(
        listing=listing,
        file=media_file,
        is_primary=is_primary,
        display_order=current_count,
    )

    return Response({
        'success': True,
        'data': {
            'id': str(media.id),
            'file_url': absolute_file_field(request, media.file),
            'is_primary': media.is_primary,
            'photo_count': current_count + 1,
            'max_photos': MAX_LISTING_PHOTOS,
        },
    }, status=status.HTTP_201_CREATED)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_media(request, listing_id, media_id):
    """Delete a photo from a listing. Owner only."""
    listing = get_object_or_404(Listing, id=listing_id, owner=request.user)
    media = get_object_or_404(ListingMedia, id=media_id, listing=listing)
    media.delete()
    return Response({'success': True, 'message': 'Photo removed.'})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def report_listing(request, listing_id):
    """Report a listing."""
    listing = get_object_or_404(Listing, id=listing_id)

    if listing.owner == request.user:
        return Response(
            {'success': False, 'errors': 'You cannot report your own listing.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if ListingReport.objects.filter(listing=listing, reporter=request.user).exists():
        return Response(
            {'success': False, 'errors': 'You have already reported this listing.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    serializer = ListingReportSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    serializer.save(listing=listing, reporter=request.user)

    return Response({
        'success': True,
        'message': 'Report submitted. Our team will review it.',
    }, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([])
def listing_availability(request, listing_id):
    """
    Returns booked date ranges for a listing so the mobile app can
    display an availability calendar on the listing detail screen.

    Returns an array of {start_date, end_date, status} for all
    confirmed/active bookings within the next 90 days.
    """
    from bookings.models import Booking, BookingStatus
    from datetime import date, timedelta

    listing = get_object_or_404(Listing, id=listing_id, status='active')
    today = date.today()
    range_end = today + timedelta(days=90)

    booked = Booking.objects.filter(
        listing=listing,
        status__in=[BookingStatus.CONFIRMED, BookingStatus.ACTIVE, BookingStatus.PENDING],
        end_date__gte=today,
        start_date__lte=range_end,
    ).values('start_date', 'end_date', 'status').order_by('start_date')

    return Response({
        'success': True,
        'data': [
            {
                'start_date': b['start_date'].isoformat(),
                'end_date': b['end_date'].isoformat(),
                'status': b['status'],
            }
            for b in booked
        ],
    })
