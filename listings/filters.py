import django_filters
from .models import Listing, ResourceType, ListingStatus


class ListingFilter(django_filters.FilterSet):
    status = django_filters.ChoiceFilter(choices=ListingStatus.choices)
    resource_type = django_filters.ChoiceFilter(choices=ResourceType.choices)
    city = django_filters.CharFilter(
        field_name='location_city',
        lookup_expr='icontains',
    )
    is_available = django_filters.BooleanFilter()
    min_price_daily = django_filters.NumberFilter(
        field_name='price_daily',
        lookup_expr='gte',
    )
    max_price_daily = django_filters.NumberFilter(
        field_name='price_daily',
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

    class Meta:
        model = Listing
        fields = [
            'status', 'resource_type', 'city',
            'is_available', 'min_price_daily', 'max_price_daily',
            'created_after', 'created_before',
        ]
