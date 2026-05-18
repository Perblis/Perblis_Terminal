from datetime import date, timedelta
from decimal import Decimal

from django.db.models import Sum, Count, Q, Avg
from django.db.models.functions import TruncMonth
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.models import OwnerProfile
from bookings.models import Booking, BookingStatus
from listings.models import Listing
from messaging.models import Thread, Message
from core.permissions import IsOwnerRole

from .serializers import (
    OwnerProfileSerializer,
    UpdateBusinessProfileSerializer,
    UpdateBankAccountSerializer,
    UpdateNotificationPreferencesSerializer,
    DashboardPendingBookingSerializer,
    DashboardRecentThreadSerializer,
    CalendarListingSerializer,
    RevenueByListingSerializer,
    MonthlyTrendSerializer,
    ListingPerformanceSerializer,
)


def get_or_create_owner_profile(user):
    profile, _ = OwnerProfile.objects.get_or_create(user=user)
    return profile


# ─────────────────────────────────────────────────────────────
# DASHBOARD
# ─────────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated, IsOwnerRole])
def owner_dashboard(request):
    """
    Single endpoint for all owner dashboard headline stats.
    Returns stats, pending requests (top 5), and recent messages (top 5).
    """
    user = request.user
    now = timezone.now()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    total_listings = Listing.objects.filter(owner=user).count()
    active_listings = Listing.objects.filter(owner=user, status='active').count()

    pending_requests = Booking.objects.filter(
        owner=user,
        status=BookingStatus.PENDING,
    ).count()

    active_bookings = Booking.objects.filter(
        owner=user,
        status__in=[BookingStatus.CONFIRMED, BookingStatus.ACTIVE],
    ).count()

    unread_messages = Message.objects.filter(
        thread__participants=user,
        is_read=False,
    ).exclude(sender=user).count()

    revenue_this_month = Booking.objects.filter(
        owner=user,
        status__in=[BookingStatus.CONFIRMED, BookingStatus.ACTIVE, BookingStatus.COMPLETED],
        created_at__gte=month_start,
    ).aggregate(total=Sum('owner_payout_amount'))['total'] or Decimal('0.00')

    pending_bookings_qs = Booking.objects.filter(
        owner=user,
        status=BookingStatus.PENDING,
    ).select_related('renter', 'listing').order_by('created_at')[:5]

    recent_threads_qs = Thread.objects.filter(
        participants=user,
    ).prefetch_related('participants', 'messages').select_related(
        'listing', 'booking'
    ).order_by('-updated_at')[:5]

    pending_serializer = DashboardPendingBookingSerializer(
        pending_bookings_qs,
        many=True,
        context={'request': request},
    )

    threads_serializer = DashboardRecentThreadSerializer(
        recent_threads_qs,
        many=True,
        context={'request': request},
    )

    return Response({
        'success': True,
        'data': {
            'stats': {
                'total_listings': total_listings,
                'active_listings': active_listings,
                'pending_booking_requests': pending_requests,
                'active_bookings': active_bookings,
                'unread_messages': unread_messages,
                'revenue_this_month': str(revenue_this_month),
            },
            'pending_requests': pending_serializer.data,
            'recent_messages': threads_serializer.data,
        },
    })


# ─────────────────────────────────────────────────────────────
# ACTIVITY FEED (UNIFIED)
# ─────────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated, IsOwnerRole])
def activity_feed(request):
    """
    Unified activity feed: recent booking events + messages merged chronologically.
    Returns up to 20 items, each with a `type` field (booking_request, booking_accepted,
    booking_cancelled, message) and a `timestamp`.
    """
    user = request.user
    limit = min(int(request.query_params.get('limit', 20)), 50)

    recent_bookings = Booking.objects.filter(
        owner=user,
    ).select_related('renter', 'listing').order_by('-updated_at')[:limit]

    recent_messages = Message.objects.filter(
        thread__participants=user,
    ).exclude(sender=user).select_related(
        'sender', 'thread', 'thread__listing'
    ).order_by('-created_at')[:limit]

    feed_items = []

    for booking in recent_bookings:
        event_type = 'booking_request'
        if booking.status == BookingStatus.CONFIRMED:
            event_type = 'booking_confirmed'
        elif booking.status == BookingStatus.ACTIVE:
            event_type = 'booking_active'
        elif booking.status == BookingStatus.COMPLETED:
            event_type = 'booking_completed'
        elif booking.status in [BookingStatus.CANCELLED, BookingStatus.CANCELLED_RENTER,
                                 BookingStatus.CANCELLED_OWNER, BookingStatus.CANCELLED_ADMIN]:
            event_type = 'booking_cancelled'
        elif booking.status == BookingStatus.DECLINED:
            event_type = 'booking_declined'

        feed_items.append({
            'type': event_type,
            'id': str(booking.id),
            'timestamp': booking.updated_at.isoformat(),
            'actor_name': booking.renter.full_name,
            'actor_photo': booking.renter.profile_photo.url if booking.renter.profile_photo else None,
            'title': booking.listing.title,
            'subtitle': f"{booking.start_date.strftime('%b %d')} – {booking.end_date.strftime('%b %d')}",
            'amount': str(booking.gross_amount),
            'status': booking.status,
            'link': f"/bookings/{booking.id}",
        })

    for msg in recent_messages:
        listing_title = msg.thread.listing.title if msg.thread.listing else 'Unknown'
        feed_items.append({
            'type': 'message',
            'id': str(msg.id),
            'timestamp': msg.created_at.isoformat(),
            'actor_name': msg.sender.full_name,
            'actor_photo': msg.sender.profile_photo.url if msg.sender.profile_photo else None,
            'title': listing_title,
            'subtitle': msg.body[:80] if msg.body else '',
            'amount': None,
            'status': None,
            'link': f"/messages/{msg.thread.id}",
        })

    feed_items.sort(key=lambda x: x['timestamp'], reverse=True)
    feed_items = feed_items[:limit]

    return Response({
        'success': True,
        'count': len(feed_items),
        'data': feed_items,
    })


# ─────────────────────────────────────────────────────────────
# BOOKING CALENDAR
# ─────────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated, IsOwnerRole])
def booking_calendar(request):
    """
    Returns all owner listings with their bookings for a given date range.

    Query params:
        start_date (required): YYYY-MM-DD
        end_date (required): YYYY-MM-DD
    """
    start_date_str = request.query_params.get('start_date')
    end_date_str = request.query_params.get('end_date')

    if not start_date_str or not end_date_str:
        return Response(
            {'success': False, 'errors': 'start_date and end_date are required.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        from datetime import datetime
        start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
        end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
    except ValueError:
        return Response(
            {'success': False, 'errors': 'Dates must be in YYYY-MM-DD format.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if end_date < start_date:
        return Response(
            {'success': False, 'errors': 'end_date must be on or after start_date.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if (end_date - start_date).days > 90:
        return Response(
            {'success': False, 'errors': 'Date range cannot exceed 90 days.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user = request.user

    listings = Listing.objects.filter(
        owner=user,
        status__in=['active', 'paused'],
    ).order_by('resource_type', 'title')

    bookings = Booking.objects.filter(
        listing__in=listings,
        status__in=[
            BookingStatus.PENDING,
            BookingStatus.CONFIRMED,
            BookingStatus.ACTIVE,
        ],
        start_date__lt=end_date,
        end_date__gt=start_date,
    ).select_related('renter', 'listing').order_by('start_date')

    bookings_by_listing = {}
    for booking in bookings:
        key = str(booking.listing.id)
        if key not in bookings_by_listing:
            bookings_by_listing[key] = []
        bookings_by_listing[key].append(booking)

    serializer = CalendarListingSerializer(
        listings,
        many=True,
        context={
            'request': request,
            'bookings_by_listing': bookings_by_listing,
        },
    )

    return Response({
        'success': True,
        'start_date': start_date_str,
        'end_date': end_date_str,
        'listing_count': listings.count(),
        'data': serializer.data,
    })


# ─────────────────────────────────────────────────────────────
# ANALYTICS
# ─────────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated, IsOwnerRole])
def analytics_revenue(request):
    """
    Revenue analytics for the owner.

    Query params:
        period: 'month' (default) | 'quarter' | 'year' | 'all'
        year: YYYY (used with period=month or period=quarter)
        month: 1-12 (used with period=month only)
    """
    user = request.user
    period = request.query_params.get('period', 'month')
    now = timezone.now()

    if period == 'month':
        try:
            year = int(request.query_params.get('year', now.year))
            month = int(request.query_params.get('month', now.month))
        except ValueError:
            return Response(
                {'success': False, 'errors': 'year and month must be integers.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        from datetime import datetime
        import calendar
        last_day = calendar.monthrange(year, month)[1]
        range_start = date(year, month, 1)
        range_end = date(year, month, last_day)
        period_label = f"{datetime(year, month, 1).strftime('%B %Y')}"

    elif period == 'quarter':
        year = int(request.query_params.get('year', now.year))
        quarter = (now.month - 1) // 3 + 1
        quarter_start_month = (quarter - 1) * 3 + 1
        range_start = date(year, quarter_start_month, 1)
        import calendar
        last_month = quarter_start_month + 2
        last_day = calendar.monthrange(year, last_month)[1]
        range_end = date(year, last_month, last_day)
        period_label = f"Q{quarter} {year}"

    elif period == 'year':
        year = int(request.query_params.get('year', now.year))
        range_start = date(year, 1, 1)
        range_end = date(year, 12, 31)
        period_label = str(year)

    else:  # 'all'
        range_start = date(2020, 1, 1)
        range_end = date(2100, 1, 1)
        period_label = 'All Time'

    base_qs = Booking.objects.filter(
        owner=user,
        status__in=[
            BookingStatus.CONFIRMED,
            BookingStatus.ACTIVE,
            BookingStatus.COMPLETED,
        ],
        start_date__gte=range_start,
        start_date__lte=range_end,
    )

    totals = base_qs.aggregate(
        gross_total=Sum('gross_amount'),
        commission_total=Sum('commission_amount'),
        payout_total=Sum('owner_payout_amount'),
        booking_count=Count('id'),
    )

    gross_total = totals['gross_total'] or Decimal('0.00')
    commission_total = totals['commission_total'] or Decimal('0.00')
    payout_total = totals['payout_total'] or Decimal('0.00')
    booking_count = totals['booking_count'] or 0
    avg_booking_value = (
        (gross_total / booking_count).quantize(Decimal('0.01'))
        if booking_count > 0 else Decimal('0.00')
    )

    by_listing_qs = base_qs.values(
        'listing__id', 'listing__title', 'listing__resource_type'
    ).annotate(
        gross=Sum('gross_amount'),
        commission=Sum('commission_amount'),
        payout=Sum('owner_payout_amount'),
        count=Count('id'),
    ).order_by('-gross')

    by_listing = [
        {
            'listing_id': str(row['listing__id']),
            'listing_title': row['listing__title'],
            'resource_type': row['listing__resource_type'],
            'gross_total': row['gross'] or Decimal('0.00'),
            'commission_total': row['commission'] or Decimal('0.00'),
            'payout_total': row['payout'] or Decimal('0.00'),
            'booking_count': row['count'],
        }
        for row in by_listing_qs
    ]

    twelve_months_ago = (now - timedelta(days=365)).date()
    monthly_qs = Booking.objects.filter(
        owner=user,
        status__in=[BookingStatus.CONFIRMED, BookingStatus.ACTIVE, BookingStatus.COMPLETED],
        start_date__gte=twelve_months_ago,
    ).annotate(
        month=TruncMonth('start_date')
    ).values('month').annotate(
        gross=Sum('gross_amount'),
        count=Count('id'),
    ).order_by('month')

    import calendar
    monthly_trend = [
        {
            'year': row['month'].year,
            'month': row['month'].month,
            'month_label': row['month'].strftime('%b %Y'),
            'gross_total': row['gross'] or Decimal('0.00'),
            'booking_count': row['count'],
        }
        for row in monthly_qs
    ]

    return Response({
        'success': True,
        'period': period,
        'period_label': period_label,
        'data': {
            'gross_total': str(gross_total),
            'commission_total': str(commission_total),
            'payout_total': str(payout_total),
            'booking_count': booking_count,
            'avg_booking_value': str(avg_booking_value),
            'by_listing': RevenueByListingSerializer(by_listing, many=True).data,
            'monthly_trend': MonthlyTrendSerializer(monthly_trend, many=True).data,
        },
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsOwnerRole])
def analytics_performance(request):
    """
    Listing performance analytics for the owner.

    Query params:
        period: 'last_30_days' (default) | 'last_90_days' | 'last_year' | 'all'
    """
    user = request.user
    period = request.query_params.get('period', 'last_30_days')
    now = timezone.now()

    if period == 'last_30_days':
        since = (now - timedelta(days=30)).date()
        period_label = 'Last 30 days'
    elif period == 'last_90_days':
        since = (now - timedelta(days=90)).date()
        period_label = 'Last 90 days'
    elif period == 'last_year':
        since = (now - timedelta(days=365)).date()
        period_label = 'Last 12 months'
    else:
        since = date(2020, 1, 1)
        period_label = 'All time'

    listings = Listing.objects.filter(owner=user).order_by('-created_at')

    performance_data = []
    for listing in listings:
        period_bookings = Booking.objects.filter(
            listing=listing,
            created_at__date__gte=since,
        )
        total_requests = period_bookings.count()
        confirmed = period_bookings.filter(
            status__in=[BookingStatus.CONFIRMED, BookingStatus.ACTIVE, BookingStatus.COMPLETED]
        ).count()

        inquiry_count = Thread.objects.filter(
            listing=listing,
            booking__isnull=True,
            created_at__date__gte=since,
        ).count()

        conversion_rate = (
            round((confirmed / total_requests) * 100, 1)
            if total_requests > 0 else 0.0
        )

        period_days = (now.date() - since).days or 1
        booked_bookings = Booking.objects.filter(
            listing=listing,
            status__in=[BookingStatus.CONFIRMED, BookingStatus.ACTIVE, BookingStatus.COMPLETED],
            start_date__gte=since,
        )
        booked_days = sum(
            min((b.end_date - b.start_date).days, period_days)
            for b in booked_bookings
        )
        occupancy_rate = round(min((booked_days / period_days) * 100, 100), 1)

        performance_data.append({
            'listing_id': listing.id,
            'listing_title': listing.title,
            'resource_type': listing.resource_type,
            'status': listing.status,
            'views': listing.view_count,
            'inquiry_count': inquiry_count,
            'booking_request_count': total_requests,
            'confirmed_booking_count': confirmed,
            'occupancy_rate': occupancy_rate,
            'conversion_rate': conversion_rate,
        })

    performance_data.sort(key=lambda x: x['views'], reverse=True)

    total_all_requests = sum(p['booking_request_count'] for p in performance_data)
    total_all_confirmed = sum(p['confirmed_booking_count'] for p in performance_data)
    overall_conversion = (
        round((total_all_confirmed / total_all_requests) * 100, 1)
        if total_all_requests > 0 else 0.0
    )

    return Response({
        'success': True,
        'period': period,
        'period_label': period_label,
        'data': {
            'total_views': sum(p['views'] for p in performance_data),
            'total_inquiries': sum(p['inquiry_count'] for p in performance_data),
            'total_booking_requests': total_all_requests,
            'total_confirmed': total_all_confirmed,
            'overall_conversion_rate': overall_conversion,
            'by_listing': ListingPerformanceSerializer(performance_data, many=True).data,
        },
    })


# ─────────────────────────────────────────────────────────────
# LISTING: STATS, DUPLICATE, BULK
# ─────────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated, IsOwnerRole])
def listing_stats(request, listing_id):
    """Per-listing performance stats. Owner only."""
    listing = get_object_or_404(Listing, id=listing_id, owner=request.user)

    all_bookings = Booking.objects.filter(listing=listing)
    confirmed = all_bookings.filter(
        status__in=[BookingStatus.CONFIRMED, BookingStatus.ACTIVE, BookingStatus.COMPLETED]
    )
    total_requests = all_bookings.count()
    confirmed_count = confirmed.count()

    inquiry_count = Thread.objects.filter(
        listing=listing,
        booking__isnull=True,
    ).count()

    ninety_days_ago = (timezone.now() - timedelta(days=90)).date()
    recent_confirmed = Booking.objects.filter(
        listing=listing,
        status__in=[BookingStatus.CONFIRMED, BookingStatus.ACTIVE, BookingStatus.COMPLETED],
        start_date__gte=ninety_days_ago,
    )
    booked_days = sum((b.end_date - b.start_date).days for b in recent_confirmed)
    occupancy_rate = round(min((booked_days / 90) * 100, 100), 1)

    revenue = confirmed.aggregate(
        gross=Sum('gross_amount'),
        payout=Sum('owner_payout_amount'),
    )

    conversion_rate = (
        round((confirmed_count / total_requests) * 100, 1)
        if total_requests > 0 else 0.0
    )

    return Response({
        'success': True,
        'data': {
            'listing_id': str(listing.id),
            'view_count': listing.view_count,
            'inquiry_count': inquiry_count,
            'booking_request_count': total_requests,
            'confirmed_booking_count': confirmed_count,
            'conversion_rate': conversion_rate,
            'occupancy_rate_90d': occupancy_rate,
            'total_gross_revenue': str(revenue['gross'] or Decimal('0.00')),
            'total_payout': str(revenue['payout'] or Decimal('0.00')),
        },
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsOwnerRole])
def duplicate_listing(request, listing_id):
    """
    Duplicate a listing as a new draft.
    Photos are NOT duplicated — owner must re-upload for the new listing.
    """
    original = get_object_or_404(Listing, id=listing_id, owner=request.user)

    duplicate = Listing.objects.create(
        owner=request.user,
        resource_type=original.resource_type,
        title=f"{original.title} (Copy)",
        description=original.description,
        category=original.category,
        price_daily=original.price_daily,
        price_weekly=original.price_weekly,
        price_monthly=original.price_monthly,
        specs=original.specs,
        location=original.location,
        location_address=original.location_address,
        location_city=original.location_city,
        operator_available=original.operator_available,
        delivery_available=original.delivery_available,
        status='draft',
        is_available=True,
        verification_tier='basic',
        view_count=0,
    )

    from listings.serializers import ListingSerializer
    return Response({
        'success': True,
        'message': 'Listing duplicated as draft. Add photos and publish when ready.',
        'data': ListingSerializer(duplicate, context={'request': request}).data,
    }, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsOwnerRole])
def bulk_listing_action(request):
    """
    Perform a bulk status action on multiple listings.

    Body:
        ids: [uuid, uuid, ...]
        action: 'activate' | 'pause' | 'archive'
    """
    ids = request.data.get('ids', [])
    action = request.data.get('action', '')

    if not ids:
        return Response(
            {'success': False, 'errors': 'ids must be a non-empty list.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if action not in ['activate', 'pause', 'archive']:
        return Response(
            {'success': False, 'errors': "action must be 'activate', 'pause', or 'archive'."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if len(ids) > 50:
        return Response(
            {'success': False, 'errors': 'Cannot action more than 50 listings at once.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    listings = Listing.objects.filter(id__in=ids, owner=request.user)
    found_count = listings.count()

    if found_count == 0:
        return Response(
            {'success': False, 'errors': 'No matching listings found.'},
            status=status.HTTP_404_NOT_FOUND,
        )

    status_map = {
        'activate': 'active',
        'pause': 'paused',
        'archive': 'archived',
    }

    if action == 'activate':
        activated_count = 0
        skipped_count = 0
        skipped_titles = []

        for listing in listings:
            if listing.location and listing.media.exists():
                listing.status = 'active'
                listing.save(update_fields=['status'])
                activated_count += 1
            else:
                skipped_count += 1
                skipped_titles.append(listing.title)

        return Response({
            'success': True,
            'message': f"Activated {activated_count} listings.",
            'activated': activated_count,
            'skipped': skipped_count,
            'skipped_reason': 'Missing location or photos',
            'skipped_listings': skipped_titles,
        })

    updated = listings.update(status=status_map[action])

    return Response({
        'success': True,
        'message': f"Updated {updated} listings to '{action}'.",
        'updated_count': updated,
    })


# ─────────────────────────────────────────────────────────────
# OWNER SETTINGS
# ─────────────────────────────────────────────────────────────

@api_view(['GET', 'PUT', 'PATCH'])
@permission_classes([IsAuthenticated, IsOwnerRole])
@parser_classes([MultiPartParser, FormParser])
def business_profile(request):
    """Get or update the owner's business profile."""
    profile = get_or_create_owner_profile(request.user)

    if request.method == 'GET':
        serializer = OwnerProfileSerializer(profile)
        return Response({'success': True, 'data': serializer.data})

    serializer = UpdateBusinessProfileSerializer(
        profile, data=request.data, partial=True
    )
    serializer.is_valid(raise_exception=True)
    serializer.save()

    return Response({
        'success': True,
        'message': 'Business profile updated.',
        'data': OwnerProfileSerializer(profile).data,
    })


@api_view(['GET', 'PUT', 'PATCH'])
@permission_classes([IsAuthenticated, IsOwnerRole])
def bank_account(request):
    """Get or update the owner's bank account details."""
    profile = get_or_create_owner_profile(request.user)

    if request.method == 'GET':
        return Response({
            'success': True,
            'data': {
                'bank_name': profile.bank_name,
                'bank_account_number': profile.bank_account_number,
                'bank_account_name': profile.bank_account_name,
            },
        })

    serializer = UpdateBankAccountSerializer(
        profile, data=request.data, partial=True
    )
    serializer.is_valid(raise_exception=True)
    serializer.save()

    return Response({
        'success': True,
        'message': 'Bank account details updated.',
        'data': {
            'bank_name': profile.bank_name,
            'bank_account_number': profile.bank_account_number,
            'bank_account_name': profile.bank_account_name,
        },
    })


@api_view(['GET', 'PUT', 'PATCH'])
@permission_classes([IsAuthenticated, IsOwnerRole])
def notification_preferences(request):
    """Get or update the owner's notification preferences."""
    profile = get_or_create_owner_profile(request.user)

    if request.method == 'GET':
        serializer = UpdateNotificationPreferencesSerializer(profile)
        return Response({'success': True, 'data': serializer.data})

    serializer = UpdateNotificationPreferencesSerializer(
        profile, data=request.data, partial=True
    )
    serializer.is_valid(raise_exception=True)
    serializer.save()

    return Response({
        'success': True,
        'message': 'Notification preferences updated.',
        'data': UpdateNotificationPreferencesSerializer(profile).data,
    })


# ─────────────────────────────────────────────────────────────
# ADMIN COMMISSION DASHBOARD
# ─────────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_commission_dashboard(request):
    """
    Platform-wide commission dashboard. Superuser only.
    Shows GMV, commission earned, booking counts, new users.
    """
    if not request.user.is_superuser:
        return Response(
            {'success': False, 'errors': 'Superuser access required.'},
            status=status.HTTP_403_FORBIDDEN,
        )

    from accounts.models import User

    now = timezone.now()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    week_start = now - timedelta(days=now.weekday())

    completed_statuses = [
        BookingStatus.CONFIRMED,
        BookingStatus.ACTIVE,
        BookingStatus.COMPLETED,
    ]

    all_time = Booking.objects.filter(status__in=completed_statuses).aggregate(
        total_gmv=Sum('gross_amount'),
        total_commission=Sum('commission_amount'),
        total_payouts=Sum('owner_payout_amount'),
        booking_count=Count('id'),
    )

    this_month = Booking.objects.filter(
        status__in=completed_statuses,
        created_at__gte=month_start,
    ).aggregate(
        gmv=Sum('gross_amount'),
        commission=Sum('commission_amount'),
        booking_count=Count('id'),
    )

    status_breakdown = {}
    for s_choice in BookingStatus.choices:
        count = Booking.objects.filter(status=s_choice[0]).count()
        if count > 0:
            status_breakdown[s_choice[0]] = count

    new_users_this_week = User.objects.filter(date_joined__gte=week_start).count()
    new_users_this_month = User.objects.filter(date_joined__gte=month_start).count()
    total_users = User.objects.count()
    total_listings = Listing.objects.filter(status='active').count()

    return Response({
        'success': True,
        'data': {
            'all_time': {
                'total_gmv': str(all_time['total_gmv'] or Decimal('0.00')),
                'total_commission': str(all_time['total_commission'] or Decimal('0.00')),
                'total_payouts': str(all_time['total_payouts'] or Decimal('0.00')),
                'booking_count': all_time['booking_count'] or 0,
            },
            'this_month': {
                'gmv': str(this_month['gmv'] or Decimal('0.00')),
                'commission': str(this_month['commission'] or Decimal('0.00')),
                'booking_count': this_month['booking_count'] or 0,
            },
            'bookings_by_status': status_breakdown,
            'users': {
                'total': total_users,
                'new_this_week': new_users_this_week,
                'new_this_month': new_users_this_month,
            },
            'active_listings': total_listings,
        },
    })
