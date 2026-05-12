import pytest
from datetime import date, timedelta
from bookings.models import Booking, BookingStatus


@pytest.mark.django_db
class TestBookingModel:
    def test_booking_str(self, owner_user, renter_user):
        from tests.factories import ListingFactory
        listing = ListingFactory(owner=owner_user)
        booking = Booking.objects.create(
            renter=renter_user,
            owner=owner_user,
            listing=listing,
            start_date=date.today() + timedelta(days=5),
            end_date=date.today() + timedelta(days=10),
            duration_type='daily',
            gross_amount=250000,
            commission_rate=0.10,
            commission_amount=25000,
            owner_payout_amount=225000,
            status=BookingStatus.PENDING,
        )
        assert listing.title in str(booking)
        assert renter_user.email in str(booking)
        assert 'pending' in str(booking)

    def test_duration_days_calculation(self, owner_user, renter_user):
        from tests.factories import ListingFactory
        listing = ListingFactory(owner=owner_user)
        booking = Booking.objects.create(
            renter=renter_user,
            owner=owner_user,
            listing=listing,
            start_date=date(2026, 7, 1),
            end_date=date(2026, 7, 11),
            duration_type='daily',
            gross_amount=500000,
            commission_rate=0.10,
            commission_amount=50000,
            owner_payout_amount=450000,
        )
        assert booking.duration_days == 10

    def test_duration_days_zero_for_same_date(self, owner_user, renter_user):
        from tests.factories import ListingFactory
        listing = ListingFactory(owner=owner_user)
        today = date.today() + timedelta(days=5)
        booking = Booking.objects.create(
            renter=renter_user,
            owner=owner_user,
            listing=listing,
            start_date=today,
            end_date=today,
            duration_type='daily',
            gross_amount=50000,
            commission_rate=0.10,
            commission_amount=5000,
            owner_payout_amount=45000,
        )
        assert booking.duration_days == 0
