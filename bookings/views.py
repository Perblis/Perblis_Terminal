from django.db import transaction
from django.db.models import Q
from django.http import Http404
from django.shortcuts import get_object_or_404

from listings.models import Listing
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Booking, BookingStatus
from .serializers import (
    BookingSerializer,
    CreateBookingSerializer,
    DeclineBookingSerializer,
    CancelBookingSerializer,
)
from messaging.services import get_or_create_booking_thread


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def booking_list_create(request):
    """
    GET: Return user's bookings with filtering, ordering, and pagination.
    POST: Create a booking request (renter role required).
    """
    from .filters import BookingFilter
    from core.pagination import StandardPagination

    if request.method == 'GET':
        role = request.query_params.get('role', 'renter')

        if role == 'owner':
            queryset = Booking.objects.filter(
                owner=request.user
            ).select_related('renter', 'owner', 'listing')
        elif role == 'both':
            queryset = Booking.objects.filter(
                Q(renter=request.user) | Q(owner=request.user)
            ).select_related('renter', 'owner', 'listing')
        else:
            queryset = Booking.objects.filter(
                renter=request.user
            ).select_related('renter', 'owner', 'listing')

        filterset = BookingFilter(request.query_params, queryset=queryset)
        if not filterset.is_valid():
            return Response(
                {'success': False, 'errors': filterset.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )
        queryset = filterset.qs

        ordering = request.query_params.get('ordering', '-created_at')
        allowed_orderings = [
            'created_at', '-created_at',
            'start_date', '-start_date',
            'end_date', '-end_date',
            'gross_amount', '-gross_amount',
        ]
        if ordering in allowed_orderings:
            queryset = queryset.order_by(ordering)

        paginator = StandardPagination()
        page = paginator.paginate_queryset(queryset, request)
        serializer = BookingSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    # POST — create booking request
    if not request.user.is_renter:
        return Response(
            {'success': False, 'errors': 'You must have the renter role to make bookings.'},
            status=status.HTTP_403_FORBIDDEN,
        )

    serializer = CreateBookingSerializer(data=request.data, context={'request': request})
    serializer.is_valid(raise_exception=True)

    data = serializer.validated_data
    amounts = data['amounts']
    listing = data['listing']

    booking = Booking.objects.create(
        renter=request.user,
        owner=listing.owner,
        listing=listing,
        start_date=data['start_date'],
        end_date=data['end_date'],
        duration_type=data['duration_type'],
        renter_note=data['renter_note'],
        gross_amount=amounts['gross_amount'],
        commission_rate=amounts['commission_rate'],
        commission_amount=amounts['commission_amount'],
        owner_payout_amount=amounts['owner_payout_amount'],
        commission_rate_label=amounts['commission_rate_label'],
        status=BookingStatus.PENDING,
    )

    get_or_create_booking_thread(booking)

    return Response(
        {'success': True, 'data': BookingSerializer(booking).data},
        status=status.HTTP_201_CREATED,
    )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def booking_detail(request, booking_id):
    """Get booking detail. Only renter or owner can view."""
    booking = get_object_or_404(
        Booking.objects.select_related('renter', 'owner', 'listing'),
        id=booking_id,
    )

    if booking.renter != request.user and booking.owner != request.user:
        return Response(
            {'success': False, 'errors': 'You do not have access to this booking.'},
            status=status.HTTP_403_FORBIDDEN,
        )

    return Response({'success': True, 'data': BookingSerializer(booking).data})


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def booking_accept(request, booking_id):
    """Accept a pending booking. Owner only."""
    with transaction.atomic():
        try:
            listing_id = (
                Booking.objects.filter(id=booking_id, owner=request.user)
                .values_list('listing_id', flat=True)
                .get()
            )
        except Booking.DoesNotExist:
            raise Http404()

        Listing.objects.select_for_update().get(pk=listing_id)
        booking = Booking.objects.select_for_update().get(id=booking_id, owner=request.user)

        if booking.status != BookingStatus.PENDING:
            return Response(
                {'success': False, 'errors': f"Cannot accept a booking with status '{booking.status}'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        overlap = Booking.objects.filter(
            listing_id=booking.listing_id,
            status__in=[BookingStatus.CONFIRMED, BookingStatus.ACTIVE],
            start_date__lt=booking.end_date,
            end_date__gt=booking.start_date,
        ).exclude(pk=booking.pk).exists()
        if overlap:
            return Response(
                {
                    'success': False,
                    'errors': (
                        'Another confirmed or active booking already overlaps these dates '
                        'for this listing.'
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        booking.status = BookingStatus.CONFIRMED
        booking.save(update_fields=['status', 'updated_at'])

    return Response({
        'success': True,
        'message': 'Booking confirmed.',
        'data': BookingSerializer(booking).data,
    })


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def booking_decline(request, booking_id):
    """Decline a pending booking. Owner only."""
    booking = get_object_or_404(Booking, id=booking_id, owner=request.user)

    if booking.status != BookingStatus.PENDING:
        return Response(
            {'success': False, 'errors': f"Cannot decline a booking with status '{booking.status}'."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    serializer = DeclineBookingSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    booking.status = BookingStatus.DECLINED
    booking.cancellation_reason = serializer.validated_data.get('reason', '')
    booking.save(update_fields=['status', 'cancellation_reason', 'updated_at'])

    return Response({
        'success': True,
        'message': 'Booking declined.',
        'data': BookingSerializer(booking).data,
    })


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def booking_cancel(request, booking_id):
    """Cancel a booking. Either renter or owner can cancel."""
    booking = get_object_or_404(
        Booking.objects.filter(Q(renter=request.user) | Q(owner=request.user)),
        id=booking_id,
    )

    cancellable_statuses = [BookingStatus.PENDING, BookingStatus.CONFIRMED]
    if booking.status not in cancellable_statuses:
        return Response(
            {'success': False, 'errors': f"Cannot cancel a booking with status '{booking.status}'."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    serializer = CancelBookingSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    if request.user == booking.renter:
        booking.status = BookingStatus.CANCELLED_RENTER
    elif request.user == booking.owner:
        booking.status = BookingStatus.CANCELLED_OWNER
    else:
        booking.status = BookingStatus.CANCELLED

    booking.cancelled_by = request.user
    booking.cancellation_reason = serializer.validated_data.get('reason', '')
    booking.save(update_fields=['status', 'cancelled_by', 'cancellation_reason', 'updated_at'])

    return Response({
        'success': True,
        'message': 'Booking cancelled.',
        'data': BookingSerializer(booking).data,
    })


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def booking_mark_paid(request, booking_id):
    """
    Mark a booking as paid. MVP simulation — no real payment.
    Either party can mark as paid.
    """
    booking = get_object_or_404(
        Booking.objects.filter(Q(renter=request.user) | Q(owner=request.user)),
        id=booking_id,
    )

    if booking.status != BookingStatus.CONFIRMED:
        return Response(
            {'success': False, 'errors': 'Only confirmed bookings can be marked as paid.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    booking.payment_status = 'simulated_paid'
    booking.status = BookingStatus.ACTIVE
    booking.save(update_fields=['payment_status', 'status', 'updated_at'])

    print(f"[DEV PAYMENT] Booking {booking.id} marked as paid (simulated) by {request.user.email}")

    return Response({
        'success': True,
        'message': 'Booking marked as paid. Status is now active.',
        'data': BookingSerializer(booking).data,
    })


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def booking_complete(request, booking_id):
    """
    Mark an active booking as completed. Owner only.
    Per FSD §9.5.2: once the rental period concludes, booking moves to completed.
    """
    booking = get_object_or_404(Booking, id=booking_id, owner=request.user)

    if booking.status != BookingStatus.ACTIVE:
        return Response(
            {'success': False, 'errors': f"Cannot complete a booking with status '{booking.status}'. Only active bookings can be completed."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    booking.status = BookingStatus.COMPLETED
    booking.save(update_fields=['status', 'updated_at'])

    return Response({
        'success': True,
        'message': 'Booking marked as completed.',
        'data': BookingSerializer(booking).data,
    })
