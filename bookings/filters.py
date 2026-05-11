import django_filters
from .models import Booking, BookingStatus, PaymentStatus


class BookingFilter(django_filters.FilterSet):
    status = django_filters.ChoiceFilter(choices=BookingStatus.choices)
    payment_status = django_filters.ChoiceFilter(choices=PaymentStatus.choices)
    listing_id = django_filters.UUIDFilter(field_name='listing__id')
    listing_title = django_filters.CharFilter(
        field_name='listing__title',
        lookup_expr='icontains',
    )
    renter_email = django_filters.CharFilter(
        field_name='renter__email',
        lookup_expr='icontains',
    )
    start_date_from = django_filters.DateFilter(
        field_name='start_date',
        lookup_expr='gte',
    )
    start_date_to = django_filters.DateFilter(
        field_name='start_date',
        lookup_expr='lte',
    )
    end_date_from = django_filters.DateFilter(
        field_name='end_date',
        lookup_expr='gte',
    )
    end_date_to = django_filters.DateFilter(
        field_name='end_date',
        lookup_expr='lte',
    )
    created_after = django_filters.DateFilter(
        field_name='created_at',
        lookup_expr='date__gte',
    )
    created_before = django_filters.DateFilter(
        field_name='created_at',
        lookup_expr='date__lte',
    )
    min_amount = django_filters.NumberFilter(
        field_name='gross_amount',
        lookup_expr='gte',
    )
    max_amount = django_filters.NumberFilter(
        field_name='gross_amount',
        lookup_expr='lte',
    )

    class Meta:
        model = Booking
        fields = [
            'status', 'payment_status', 'listing_id', 'listing_title',
            'renter_email', 'start_date_from', 'start_date_to',
            'end_date_from', 'end_date_to',
            'created_after', 'created_before',
            'min_amount', 'max_amount',
        ]
