import pytest
from datetime import date, timedelta
from decimal import Decimal
from bookings.models import BookingStatus


@pytest.mark.django_db
class TestOwnerDashboard:
    URL = '/api/v1/owner/dashboard/'

    def test_non_owner_gets_403(self, auth_client):
        response = auth_client.get(self.URL)
        assert response.status_code == 403

    def test_unauthenticated_gets_401(self, api_client):
        response = api_client.get(self.URL)
        assert response.status_code == 401

    def test_dashboard_returns_all_stat_keys(self, owner_client):
        response = owner_client.get(self.URL)
        assert response.status_code == 200
        stats = response.data['data']['stats']
        assert 'total_listings' in stats
        assert 'active_listings' in stats
        assert 'pending_booking_requests' in stats
        assert 'active_bookings' in stats
        assert 'unread_messages' in stats
        assert 'revenue_this_month' in stats

    def test_pending_requests_limited_to_5(self, owner_client, owner_user, renter_user):
        from tests.factories import ListingFactory, BookingFactory
        listing = ListingFactory(owner=owner_user)
        for _ in range(7):
            BookingFactory(renter=renter_user, owner=owner_user, listing=listing, status='pending')
        response = owner_client.get(self.URL)
        assert len(response.data['data']['pending_requests']) <= 5

    def test_pending_count_matches_actual(self, owner_client, owner_user, renter_user):
        from tests.factories import ListingFactory, BookingFactory
        listing = ListingFactory(owner=owner_user)
        BookingFactory(renter=renter_user, owner=owner_user, listing=listing, status='pending')
        BookingFactory(renter=renter_user, owner=owner_user, listing=listing, status='pending')
        BookingFactory(renter=renter_user, owner=owner_user, listing=listing, status='confirmed')
        response = owner_client.get(self.URL)
        assert response.data['data']['stats']['pending_booking_requests'] == 2

    def test_active_listings_count(self, owner_client, owner_user):
        from tests.factories import ListingFactory
        ListingFactory(owner=owner_user, status='active')
        ListingFactory(owner=owner_user, status='active')
        ListingFactory(owner=owner_user, status='draft')
        response = owner_client.get(self.URL)
        assert response.data['data']['stats']['active_listings'] == 2


@pytest.mark.django_db
class TestBookingCalendar:
    URL = '/api/v1/owner/bookings/calendar/'

    def test_requires_start_and_end_date(self, owner_client):
        response = owner_client.get(self.URL)
        assert response.status_code == 400

    def test_rejects_range_over_90_days(self, owner_client):
        response = owner_client.get(
            f'{self.URL}?start_date=2026-01-01&end_date=2026-12-31'
        )
        assert response.status_code == 400

    def test_rejects_end_before_start(self, owner_client):
        response = owner_client.get(
            f'{self.URL}?start_date=2026-07-31&end_date=2026-07-01'
        )
        assert response.status_code == 400

    def test_returns_listings_with_bookings(self, owner_client, owner_user, renter_user):
        from tests.factories import ListingFactory, ConfirmedBookingFactory
        listing = ListingFactory(owner=owner_user, status='active')
        start = date(2026, 7, 1)
        end = date(2026, 7, 10)
        ConfirmedBookingFactory(
            renter=renter_user, owner=owner_user, listing=listing,
            start_date=start, end_date=end,
        )
        response = owner_client.get(
            f'{self.URL}?start_date=2026-07-01&end_date=2026-07-31'
        )
        assert response.status_code == 200
        assert response.data['listing_count'] >= 1
        listing_data = next(
            (l for l in response.data['data'] if str(l['id']) == str(listing.id)), None
        )
        assert listing_data is not None
        assert len(listing_data['bookings']) == 1

    def test_listings_outside_range_have_empty_bookings(
        self, owner_client, owner_user, renter_user
    ):
        from tests.factories import ListingFactory, ConfirmedBookingFactory
        listing = ListingFactory(owner=owner_user, status='active')
        ConfirmedBookingFactory(
            renter=renter_user, owner=owner_user, listing=listing,
            start_date=date(2026, 9, 1),
            end_date=date(2026, 9, 10),
        )
        response = owner_client.get(
            f'{self.URL}?start_date=2026-07-01&end_date=2026-07-31'
        )
        listing_data = next(
            (l for l in response.data['data'] if str(l['id']) == str(listing.id)), None
        )
        if listing_data:
            assert len(listing_data['bookings']) == 0

    def test_non_owner_gets_403(self, auth_client):
        response = auth_client.get(
            f'{self.URL}?start_date=2026-07-01&end_date=2026-07-31'
        )
        assert response.status_code == 403


@pytest.mark.django_db
class TestAnalyticsRevenue:
    URL = '/api/v1/owner/analytics/revenue/'

    def test_non_owner_gets_403(self, auth_client):
        response = auth_client.get(self.URL)
        assert response.status_code == 403

    def test_returns_required_keys(self, owner_client):
        response = owner_client.get(self.URL)
        assert response.status_code == 200
        data = response.data['data']
        assert 'gross_total' in data
        assert 'commission_total' in data
        assert 'payout_total' in data
        assert 'booking_count' in data
        assert 'avg_booking_value' in data
        assert 'by_listing' in data
        assert 'monthly_trend' in data

    def test_zero_revenue_when_no_bookings(self, owner_client):
        response = owner_client.get(self.URL)
        assert response.data['data']['gross_total'] == '0.00'
        assert response.data['data']['booking_count'] == 0

    def test_revenue_includes_confirmed_bookings(self, owner_client, owner_user, renter_user):
        from tests.factories import ListingFactory, ConfirmedBookingFactory
        listing = ListingFactory(owner=owner_user)
        ConfirmedBookingFactory(
            renter=renter_user, owner=owner_user, listing=listing,
            gross_amount=Decimal('100000'),
            commission_amount=Decimal('10000'),
            owner_payout_amount=Decimal('90000'),
            start_date=date.today(),
            end_date=date.today() + timedelta(days=5),
        )
        response = owner_client.get(f'{self.URL}?period=all')
        assert Decimal(response.data['data']['gross_total']) == Decimal('100000')

    def test_cancelled_bookings_excluded(self, owner_client, owner_user, renter_user):
        from tests.factories import ListingFactory, BookingFactory
        listing = ListingFactory(owner=owner_user)
        BookingFactory(
            renter=renter_user, owner=owner_user, listing=listing,
            gross_amount=Decimal('100000'),
            status='cancelled',
            start_date=date.today(),
            end_date=date.today() + timedelta(days=5),
        )
        response = owner_client.get(f'{self.URL}?period=all')
        assert Decimal(response.data['data']['gross_total']) == Decimal('0.00')

    def test_period_month_filter(self, owner_client):
        response = owner_client.get(
            f'{self.URL}?period=month&year=2026&month=5'
        )
        assert response.status_code == 200
        assert response.data['period_label'] == 'May 2026'

    def test_period_all(self, owner_client):
        response = owner_client.get(f'{self.URL}?period=all')
        assert response.status_code == 200
        assert response.data['period_label'] == 'All Time'


@pytest.mark.django_db
class TestAnalyticsPerformance:
    URL = '/api/v1/owner/analytics/performance/'

    def test_non_owner_gets_403(self, auth_client):
        response = auth_client.get(self.URL)
        assert response.status_code == 403

    def test_returns_required_keys(self, owner_client):
        response = owner_client.get(self.URL)
        assert response.status_code == 200
        data = response.data['data']
        assert 'total_views' in data
        assert 'total_inquiries' in data
        assert 'total_booking_requests' in data
        assert 'total_confirmed' in data
        assert 'overall_conversion_rate' in data
        assert 'by_listing' in data

    def test_occupancy_rate_between_0_and_100(self, owner_client, owner_user, renter_user):
        from tests.factories import ListingFactory, ConfirmedBookingFactory
        listing = ListingFactory(owner=owner_user, status='active')
        ConfirmedBookingFactory(
            renter=renter_user, owner=owner_user, listing=listing,
            start_date=date.today() - timedelta(days=10),
            end_date=date.today() - timedelta(days=5),
        )
        response = owner_client.get(self.URL)
        for item in response.data['data']['by_listing']:
            assert 0 <= item['occupancy_rate'] <= 100


@pytest.mark.django_db
class TestListingStats:
    def test_owner_gets_own_listing_stats(self, owner_client, owner_user):
        from tests.factories import ListingFactory
        listing = ListingFactory(owner=owner_user, view_count=42)
        response = owner_client.get(f'/api/v1/owner/listings/{listing.id}/stats/')
        assert response.status_code == 200
        assert response.data['data']['view_count'] == 42

    def test_cannot_get_stats_for_another_owners_listing(
        self, second_owner_client, owner_user
    ):
        from tests.factories import ListingFactory
        listing = ListingFactory(owner=owner_user)
        response = second_owner_client.get(
            f'/api/v1/owner/listings/{listing.id}/stats/'
        )
        assert response.status_code == 404

    def test_stats_include_all_required_fields(self, owner_client, owner_user):
        from tests.factories import ListingFactory
        listing = ListingFactory(owner=owner_user)
        response = owner_client.get(f'/api/v1/owner/listings/{listing.id}/stats/')
        data = response.data['data']
        required_fields = [
            'view_count', 'inquiry_count', 'booking_request_count',
            'confirmed_booking_count', 'conversion_rate', 'occupancy_rate_90d',
            'total_gross_revenue', 'total_payout',
        ]
        for field in required_fields:
            assert field in data, f"Missing field: {field}"


@pytest.mark.django_db
class TestDuplicateListing:
    def test_duplicate_creates_draft_copy(self, owner_client, owner_user):
        from tests.factories import ListingFactory
        from listings.models import Listing
        listing = ListingFactory(owner=owner_user, status='active', title='Original Crane')
        response = owner_client.post(
            f'/api/v1/owner/listings/{listing.id}/duplicate/'
        )
        assert response.status_code == 201
        assert response.data['data']['status'] == 'draft'
        assert 'Copy' in response.data['data']['title']
        assert Listing.objects.filter(owner=owner_user).count() == 2

    def test_duplicate_resets_view_count(self, owner_client, owner_user):
        from tests.factories import ListingFactory
        listing = ListingFactory(owner=owner_user, view_count=150)
        response = owner_client.post(
            f'/api/v1/owner/listings/{listing.id}/duplicate/'
        )
        assert response.data['data']['view_count'] == 0

    def test_cannot_duplicate_another_owners_listing(
        self, second_owner_client, owner_user
    ):
        from tests.factories import ListingFactory
        listing = ListingFactory(owner=owner_user)
        response = second_owner_client.post(
            f'/api/v1/owner/listings/{listing.id}/duplicate/'
        )
        assert response.status_code == 404

    def test_non_owner_cannot_duplicate(self, auth_client):
        from tests.factories import ListingFactory
        listing = ListingFactory()
        response = auth_client.post(
            f'/api/v1/owner/listings/{listing.id}/duplicate/'
        )
        assert response.status_code == 403


@pytest.mark.django_db
class TestBulkListingActions:
    URL = '/api/v1/owner/listings/bulk/'

    def test_non_owner_gets_403(self, auth_client):
        response = auth_client.post(self.URL, {'ids': [], 'action': 'pause'}, format='json')
        assert response.status_code == 403

    def test_empty_ids_returns_400(self, owner_client):
        response = owner_client.post(self.URL, {'ids': [], 'action': 'pause'}, format='json')
        assert response.status_code == 400

    def test_invalid_action_returns_400(self, owner_client, owner_user):
        from tests.factories import ListingFactory
        listing = ListingFactory(owner=owner_user)
        response = owner_client.post(self.URL, {
            'ids': [str(listing.id)],
            'action': 'delete',
        }, format='json')
        assert response.status_code == 400

    def test_bulk_pause(self, owner_client, owner_user):
        from tests.factories import ListingFactory
        from listings.models import Listing
        l1 = ListingFactory(owner=owner_user, status='active')
        l2 = ListingFactory(owner=owner_user, status='active')
        response = owner_client.post(self.URL, {
            'ids': [str(l1.id), str(l2.id)],
            'action': 'pause',
        }, format='json')
        assert response.status_code == 200
        l1.refresh_from_db()
        l2.refresh_from_db()
        assert l1.status == 'paused'
        assert l2.status == 'paused'

    def test_bulk_activate_skips_listings_without_location(
        self, owner_client, owner_user
    ):
        from tests.factories import ListingFactory
        from tests.factories import make_publishable_listing
        from listings.models import Listing
        # good has location + media (satisfies activation preconditions)
        good = make_publishable_listing(owner_user)
        # bad has no location — will be skipped
        bad = ListingFactory(owner=owner_user, location=None, status='draft')
        response = owner_client.post(self.URL, {
            'ids': [str(good.id), str(bad.id)],
            'action': 'activate',
        }, format='json')
        assert response.status_code == 200
        good.refresh_from_db()
        bad.refresh_from_db()
        assert bad.status == 'draft'
        assert response.data['skipped'] == 1

    def test_cannot_action_more_than_50_listings(self, owner_client):
        import uuid
        ids = [str(uuid.uuid4()) for _ in range(51)]
        response = owner_client.post(self.URL, {
            'ids': ids,
            'action': 'pause',
        }, format='json')
        assert response.status_code == 400

    def test_ignores_other_owners_listings(self, owner_client, owner_user, second_owner_user):
        from tests.factories import ListingFactory
        own_listing = ListingFactory(owner=owner_user, status='active')
        other_listing = ListingFactory(owner=second_owner_user, status='active')
        response = owner_client.post(self.URL, {
            'ids': [str(own_listing.id), str(other_listing.id)],
            'action': 'pause',
        }, format='json')
        assert response.status_code == 200
        other_listing.refresh_from_db()
        assert other_listing.status == 'active'


@pytest.mark.django_db
class TestOwnerSettings:
    def test_non_owner_cannot_access_business_profile(self, auth_client):
        response = auth_client.get('/api/v1/owner/business-profile/')
        assert response.status_code == 403

    def test_owner_can_get_business_profile(self, owner_client):
        response = owner_client.get('/api/v1/owner/business-profile/')
        assert response.status_code == 200

    def test_owner_can_update_business_profile(self, owner_client):
        response = owner_client.patch('/api/v1/owner/business-profile/', {
            'business_name': 'Updated Company Ltd',
            'business_description': 'We lease heavy equipment.',
        })
        assert response.status_code == 200

    def test_bank_account_validation_10_digits(self, owner_client):
        response = owner_client.patch('/api/v1/owner/bank-account/', {
            'bank_name': 'GTBank',
            'bank_account_number': '123',
            'bank_account_name': 'Test User',
        })
        assert response.status_code == 400

    def test_bank_account_validation_digits_only(self, owner_client):
        response = owner_client.patch('/api/v1/owner/bank-account/', {
            'bank_name': 'GTBank',
            'bank_account_number': 'abcdefghij',
            'bank_account_name': 'Test User',
        })
        assert response.status_code == 400

    def test_valid_bank_account_update(self, owner_client):
        response = owner_client.patch('/api/v1/owner/bank-account/', {
            'bank_name': 'Zenith Bank',
            'bank_account_number': '2012345678',
            'bank_account_name': 'OWNER NAME',
        })
        assert response.status_code == 200

    def test_notification_preferences_update(self, owner_client):
        response = owner_client.patch('/api/v1/owner/notifications/', {
            'notify_new_booking_request': False,
            'notify_new_message': True,
        })
        assert response.status_code == 200

    def test_get_notifications_returns_all_preference_fields(self, owner_client):
        response = owner_client.get('/api/v1/owner/notifications/')
        data = response.data['data']
        assert 'notify_new_booking_request' in data
        assert 'notify_booking_confirmed' in data
        assert 'notify_new_message' in data
        assert 'notify_booking_cancelled' in data
