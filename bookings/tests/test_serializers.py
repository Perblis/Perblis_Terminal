import pytest
from datetime import date, timedelta
from decimal import Decimal
from bookings.serializers import calculate_booking_amounts, CreateBookingSerializer
from bookings.models import DurationType


@pytest.mark.django_db
class TestCalculateBookingAmounts:
    def test_daily_calculation(self, owner_user):
        from tests.factories import ListingFactory
        listing = ListingFactory(owner=owner_user, price_daily=50000)
        start = date.today() + timedelta(days=5)
        end = date.today() + timedelta(days=10)
        result = calculate_booking_amounts(listing, start, end, 'daily')
        assert result['gross_amount'] == Decimal('250000')
        assert result['commission_amount'] == Decimal('25000.00')
        assert result['owner_payout_amount'] == Decimal('225000.00')

    def test_weekly_calculation(self, owner_user):
        from tests.factories import ListingFactory
        listing = ListingFactory(owner=owner_user, price_weekly=300000)
        start = date.today() + timedelta(days=5)
        end = start + timedelta(days=14)
        result = calculate_booking_amounts(listing, start, end, 'weekly')
        assert result['gross_amount'] == Decimal('600000')

    def test_monthly_calculation(self, owner_user):
        from tests.factories import ListingFactory
        listing = ListingFactory(owner=owner_user, price_monthly=1500000)
        start = date.today() + timedelta(days=5)
        end = start + timedelta(days=60)
        result = calculate_booking_amounts(listing, start, end, 'monthly')
        assert result['gross_amount'] == Decimal('3000000')

    def test_commission_is_10_percent(self, owner_user):
        from tests.factories import ListingFactory
        listing = ListingFactory(owner=owner_user, price_daily=100000)
        start = date.today() + timedelta(days=5)
        end = start + timedelta(days=1)
        result = calculate_booking_amounts(listing, start, end, 'daily')
        assert result['commission_amount'] == Decimal('10000.00')
        assert result['owner_payout_amount'] == Decimal('90000.00')

    def test_payout_equals_gross_minus_commission(self, owner_user):
        from tests.factories import ListingFactory
        listing = ListingFactory(owner=owner_user, price_daily=75000)
        start = date.today() + timedelta(days=5)
        end = start + timedelta(days=3)
        result = calculate_booking_amounts(listing, start, end, 'daily')
        assert result['owner_payout_amount'] == result['gross_amount'] - result['commission_amount']

    def test_missing_daily_price_raises_error(self, owner_user):
        import pytest
        from tests.factories import ListingFactory
        from rest_framework import serializers as drf_serializers
        listing = ListingFactory(owner=owner_user, price_daily=None)
        start = date.today() + timedelta(days=5)
        end = start + timedelta(days=3)
        with pytest.raises(drf_serializers.ValidationError):
            calculate_booking_amounts(listing, start, end, 'daily')


@pytest.mark.django_db
class TestCreateBookingSerializer:
    def test_cannot_book_own_listing(self, owner_user, api_client):
        from tests.factories import ListingFactory
        from unittest.mock import MagicMock
        listing = ListingFactory(owner=owner_user, status='active')
        request = MagicMock()
        request.user = owner_user
        data = {
            'listing_id': str(listing.id),
            'start_date': str(date.today() + timedelta(days=5)),
            'end_date': str(date.today() + timedelta(days=10)),
            'duration_type': 'daily',
        }
        serializer = CreateBookingSerializer(data=data, context={'request': request})
        assert not serializer.is_valid()

    def test_past_start_date_rejected(self, renter_user):
        from tests.factories import ListingFactory
        from unittest.mock import MagicMock
        listing = ListingFactory(status='active')
        request = MagicMock()
        request.user = renter_user
        data = {
            'listing_id': str(listing.id),
            'start_date': str(date.today() - timedelta(days=1)),
            'end_date': str(date.today() + timedelta(days=5)),
            'duration_type': 'daily',
        }
        serializer = CreateBookingSerializer(data=data, context={'request': request})
        assert not serializer.is_valid()

    def test_end_before_start_rejected(self, renter_user):
        from tests.factories import ListingFactory
        from unittest.mock import MagicMock
        listing = ListingFactory(status='active')
        request = MagicMock()
        request.user = renter_user
        data = {
            'listing_id': str(listing.id),
            'start_date': str(date.today() + timedelta(days=10)),
            'end_date': str(date.today() + timedelta(days=5)),
            'duration_type': 'daily',
        }
        serializer = CreateBookingSerializer(data=data, context={'request': request})
        assert not serializer.is_valid()
