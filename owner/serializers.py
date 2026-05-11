from decimal import Decimal
from rest_framework import serializers
from accounts.models import OwnerProfile


class OwnerProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = OwnerProfile
        fields = [
            'id',
            'business_name', 'business_description', 'business_logo',
            'bank_name', 'bank_account_number', 'bank_account_name',
            'notify_new_booking_request', 'notify_booking_confirmed',
            'notify_new_message', 'notify_booking_cancelled',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class UpdateBusinessProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = OwnerProfile
        fields = ['business_name', 'business_description', 'business_logo']


class UpdateBankAccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = OwnerProfile
        fields = ['bank_name', 'bank_account_number', 'bank_account_name']

    def validate_bank_account_number(self, value):
        if value and not value.isdigit():
            raise serializers.ValidationError('Account number must contain only digits.')
        if value and len(value) != 10:
            raise serializers.ValidationError('Account number must be exactly 10 digits.')
        return value


class UpdateNotificationPreferencesSerializer(serializers.ModelSerializer):
    class Meta:
        model = OwnerProfile
        fields = [
            'notify_new_booking_request',
            'notify_booking_confirmed',
            'notify_new_message',
            'notify_booking_cancelled',
        ]


class DashboardPendingBookingSerializer(serializers.Serializer):
    """Lightweight booking for dashboard pending requests list."""
    id = serializers.UUIDField()
    listing_title = serializers.SerializerMethodField()
    listing_id = serializers.SerializerMethodField()
    renter_name = serializers.SerializerMethodField()
    renter_photo = serializers.SerializerMethodField()
    start_date = serializers.DateField()
    end_date = serializers.DateField()
    gross_amount = serializers.DecimalField(max_digits=15, decimal_places=2)
    created_at = serializers.DateTimeField()

    def get_listing_title(self, obj):
        return obj.listing.title

    def get_listing_id(self, obj):
        return str(obj.listing.id)

    def get_renter_name(self, obj):
        return obj.renter.full_name

    def get_renter_photo(self, obj):
        request = self.context.get('request')
        if obj.renter.profile_photo and request:
            return request.build_absolute_uri(obj.renter.profile_photo.url)
        return None


class DashboardRecentThreadSerializer(serializers.Serializer):
    """Lightweight thread for dashboard recent messages list."""
    id = serializers.UUIDField()
    other_participant_name = serializers.SerializerMethodField()
    other_participant_photo = serializers.SerializerMethodField()
    listing_title = serializers.SerializerMethodField()
    last_message_body = serializers.SerializerMethodField()
    last_message_time = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()

    def get_other_participant_name(self, obj):
        user = self.context.get('request').user
        other = obj.get_other_participant(user)
        return other.full_name if other else None

    def get_other_participant_photo(self, obj):
        request = self.context.get('request')
        user = request.user
        other = obj.get_other_participant(user)
        if other and other.profile_photo:
            return request.build_absolute_uri(other.profile_photo.url)
        return None

    def get_listing_title(self, obj):
        return obj.listing.title if obj.listing else None

    def get_last_message_body(self, obj):
        last = obj.messages.last()
        return last.body[:100] if last else None

    def get_last_message_time(self, obj):
        last = obj.messages.last()
        return last.created_at if last else None

    def get_unread_count(self, obj):
        user = self.context.get('request').user
        return obj.messages.filter(is_read=False).exclude(sender=user).count()


class CalendarBookingSerializer(serializers.Serializer):
    """Booking block for calendar view."""
    id = serializers.UUIDField()
    start_date = serializers.DateField()
    end_date = serializers.DateField()
    status = serializers.CharField()
    renter_name = serializers.SerializerMethodField()
    gross_amount = serializers.DecimalField(max_digits=15, decimal_places=2)

    def get_renter_name(self, obj):
        return obj.renter.full_name


class CalendarListingSerializer(serializers.Serializer):
    """Listing row for calendar view, with its bookings for the period."""
    id = serializers.UUIDField()
    title = serializers.CharField()
    resource_type = serializers.CharField()
    bookings = serializers.SerializerMethodField()

    def get_bookings(self, obj):
        bookings = self.context.get('bookings_by_listing', {}).get(str(obj.id), [])
        return CalendarBookingSerializer(bookings, many=True).data


class RevenueByListingSerializer(serializers.Serializer):
    listing_id = serializers.UUIDField()
    listing_title = serializers.CharField()
    resource_type = serializers.CharField()
    gross_total = serializers.DecimalField(max_digits=15, decimal_places=2)
    commission_total = serializers.DecimalField(max_digits=15, decimal_places=2)
    payout_total = serializers.DecimalField(max_digits=15, decimal_places=2)
    booking_count = serializers.IntegerField()


class MonthlyTrendSerializer(serializers.Serializer):
    year = serializers.IntegerField()
    month = serializers.IntegerField()
    month_label = serializers.CharField()
    gross_total = serializers.DecimalField(max_digits=15, decimal_places=2)
    booking_count = serializers.IntegerField()


class ListingPerformanceSerializer(serializers.Serializer):
    listing_id = serializers.UUIDField()
    listing_title = serializers.CharField()
    resource_type = serializers.CharField()
    status = serializers.CharField()
    views = serializers.IntegerField()
    inquiry_count = serializers.IntegerField()
    booking_request_count = serializers.IntegerField()
    confirmed_booking_count = serializers.IntegerField()
    occupancy_rate = serializers.FloatField()
    conversion_rate = serializers.FloatField()
