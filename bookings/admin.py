from django.contrib import admin
from unfold.admin import ModelAdmin

from .models import Booking
from .tasks import complete_expired_bookings


@admin.register(Booking)
class BookingAdmin(ModelAdmin):
    list_display = [
        'id', 'listing', 'renter', 'owner',
        'start_date', 'end_date', 'gross_amount',
        'commission_rate_label',
        'status', 'payment_status', 'created_at',
    ]
    list_filter = ['status', 'payment_status', 'duration_type']
    search_fields = [
        'listing__title', 'renter__email', 'owner__email',
    ]
    readonly_fields = [
        'id', 'renter', 'owner', 'listing',
        'gross_amount', 'commission_rate', 'commission_rate_label',
        'commission_amount', 'owner_payout_amount',
        'created_at', 'updated_at',
    ]
    ordering = ['-created_at']

    actions = ['cancel_bookings', 'mark_completed']

    @admin.action(description='Cancel selected bookings (admin)')
    def cancel_bookings(self, request, queryset):
        count = queryset.filter(
            status__in=['pending', 'confirmed']
        ).update(status='cancelled_admin', cancelled_by=request.user)
        self.message_user(request, f'{count} booking(s) cancelled by admin.')

    @admin.action(description='Run auto-complete (mark expired bookings as completed)')
    def mark_completed(self, request, queryset):
        result = complete_expired_bookings()
        self.message_user(
            request,
            f"{result['completed_count']} booking(s) auto-completed.",
        )
