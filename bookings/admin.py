from django.contrib import admin
from unfold.admin import ModelAdmin

from .models import Booking


@admin.register(Booking)
class BookingAdmin(ModelAdmin):
    list_display = [
        'id', 'listing', 'renter', 'owner',
        'start_date', 'end_date', 'gross_amount',
        'status', 'payment_status', 'created_at',
    ]
    list_filter = ['status', 'payment_status', 'duration_type']
    search_fields = [
        'listing__title', 'renter__email', 'owner__email',
    ]
    readonly_fields = [
        'id', 'renter', 'owner', 'listing',
        'gross_amount', 'commission_rate', 'commission_amount', 'owner_payout_amount',
        'created_at', 'updated_at',
    ]
    ordering = ['-created_at']

    actions = ['cancel_bookings']

    @admin.action(description='Cancel selected bookings')
    def cancel_bookings(self, request, queryset):
        queryset.filter(
            status__in=['pending', 'confirmed']
        ).update(status='cancelled')
