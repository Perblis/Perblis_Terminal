from datetime import timedelta
from decimal import Decimal

from django.db.models import Count, Sum
from django.utils import timezone


def dashboard_callback(request, context):
    from accounts.models import User
    from bookings.models import Booking, BookingStatus
    from listings.models import Listing

    now = timezone.now()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    week_start = now - timedelta(days=now.weekday())

    completed_statuses = [
        BookingStatus.CONFIRMED,
        BookingStatus.ACTIVE,
        BookingStatus.COMPLETED,
    ]

    all_time = Booking.objects.filter(status__in=completed_statuses).aggregate(
        total_gmv=Sum("gross_amount"),
        total_commission=Sum("commission_amount"),
        booking_count=Count("id"),
    )
    this_month = Booking.objects.filter(
        status__in=completed_statuses,
        created_at__gte=month_start,
    ).aggregate(
        gmv=Sum("gross_amount"),
        commission=Sum("commission_amount"),
        booking_count=Count("id"),
    )

    context.update(
        {
            "kpi": [
                {
                    "title": "Total GMV (All-time)",
                    "metric": f"₦{all_time['total_gmv'] or Decimal('0'):,.0f}",
                },
                {
                    "title": "Commission Earned (All-time)",
                    "metric": f"₦{all_time['total_commission'] or Decimal('0'):,.0f}",
                },
                {
                    "title": "Total Bookings",
                    "metric": str(all_time["booking_count"] or 0),
                },
                {
                    "title": "GMV (This Month)",
                    "metric": f"₦{this_month['gmv'] or Decimal('0'):,.0f}",
                },
                {
                    "title": "Commission (This Month)",
                    "metric": f"₦{this_month['commission'] or Decimal('0'):,.0f}",
                },
                {
                    "title": "Bookings (This Month)",
                    "metric": str(this_month["booking_count"] or 0),
                },
            ],
            "progress": [
                {
                    "title": "Active Listings",
                    "description": str(
                        Listing.objects.filter(status="active").count()
                    ),
                    "value": 100,
                },
                {
                    "title": "Users (Total)",
                    "description": str(User.objects.count()),
                    "value": 100,
                },
                {
                    "title": "New Users (This Week)",
                    "description": str(
                        User.objects.filter(date_joined__gte=week_start).count()
                    ),
                    "value": 100,
                },
                {
                    "title": "New Users (This Month)",
                    "description": str(
                        User.objects.filter(date_joined__gte=month_start).count()
                    ),
                    "value": 100,
                },
            ],
            "navigation": [
                {
                    "title": status_label,
                    "link": f"/admin/bookings/booking/?status__exact={slug}",
                    "value": count,
                }
                for slug, status_label in BookingStatus.choices
                if (count := Booking.objects.filter(status=slug).count()) > 0
            ],
        }
    )
    return context
