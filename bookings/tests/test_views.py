import pytest
from datetime import date, timedelta


@pytest.mark.django_db
class TestBookingListCreate:
    URL = '/api/v1/bookings/'

    def test_unauthenticated_cannot_list(self, api_client):
        response = api_client.get(self.URL)
        assert response.status_code == 401

    def test_renter_sees_own_bookings(self, auth_client, renter_user, owner_user):
        from tests.factories import ListingFactory, BookingFactory
        listing = ListingFactory(owner=owner_user)
        BookingFactory(renter=renter_user, owner=owner_user, listing=listing)
        response = auth_client.get(f'{self.URL}?role=renter')
        assert response.status_code == 200
        assert response.data['count'] == 1

    def test_owner_sees_own_bookings(self, owner_client, owner_user, renter_user):
        from tests.factories import ListingFactory, BookingFactory
        listing = ListingFactory(owner=owner_user)
        BookingFactory(renter=renter_user, owner=owner_user, listing=listing)
        response = owner_client.get(f'{self.URL}?role=owner')
        assert response.status_code == 200
        assert response.data['count'] == 1

    def test_response_is_paginated(self, auth_client):
        response = auth_client.get(self.URL)
        assert 'count' in response.data
        assert 'results' in response.data

    def test_filter_by_status(self, owner_client, owner_user, renter_user):
        from tests.factories import ListingFactory, BookingFactory
        listing = ListingFactory(owner=owner_user)
        BookingFactory(renter=renter_user, owner=owner_user, listing=listing, status='pending')
        BookingFactory(renter=renter_user, owner=owner_user, listing=listing, status='confirmed')
        response = owner_client.get(f'{self.URL}?role=owner&status=pending')
        assert response.data['count'] == 1

    def test_filter_by_listing_id(self, owner_client, owner_user, renter_user):
        from tests.factories import ListingFactory, BookingFactory
        listing1 = ListingFactory(owner=owner_user)
        listing2 = ListingFactory(owner=owner_user)
        BookingFactory(renter=renter_user, owner=owner_user, listing=listing1)
        BookingFactory(renter=renter_user, owner=owner_user, listing=listing2)
        response = owner_client.get(f'{self.URL}?role=owner&listing_id={listing1.id}')
        assert response.data['count'] == 1

    def test_non_renter_cannot_create_booking(self, owner_client, owner_user):
        from tests.factories import ListingFactory
        other_listing = ListingFactory()
        response = owner_client.post(self.URL, {
            'listing_id': str(other_listing.id),
            'start_date': str(date.today() + timedelta(days=5)),
            'end_date': str(date.today() + timedelta(days=10)),
            'duration_type': 'daily',
        }, format='json')
        assert response.status_code == 403

    def test_renter_can_create_booking(self, auth_client, renter_user, owner_user):
        from tests.factories import ListingFactory
        listing = ListingFactory(owner=owner_user, status='active', price_daily=50000)
        response = auth_client.post(self.URL, {
            'listing_id': str(listing.id),
            'start_date': str(date.today() + timedelta(days=5)),
            'end_date': str(date.today() + timedelta(days=10)),
            'duration_type': 'daily',
        }, format='json')
        assert response.status_code == 201
        assert response.data['data']['status'] == 'pending'

    def test_booking_creates_thread_automatically(self, auth_client, owner_user):
        from tests.factories import ListingFactory
        from messaging.models import Thread
        listing = ListingFactory(owner=owner_user, status='active', price_daily=50000)
        response = auth_client.post(self.URL, {
            'listing_id': str(listing.id),
            'start_date': str(date.today() + timedelta(days=5)),
            'end_date': str(date.today() + timedelta(days=10)),
            'duration_type': 'daily',
        }, format='json')
        assert response.status_code == 201
        booking_id = response.data['data']['id']
        assert Thread.objects.filter(booking__id=booking_id).exists()

    def test_booking_response_includes_thread_id(self, auth_client, owner_user):
        from tests.factories import ListingFactory
        listing = ListingFactory(owner=owner_user, status='active', price_daily=50000)
        response = auth_client.post(self.URL, {
            'listing_id': str(listing.id),
            'start_date': str(date.today() + timedelta(days=5)),
            'end_date': str(date.today() + timedelta(days=10)),
            'duration_type': 'daily',
        }, format='json')
        assert 'thread_id' in response.data['data']
        assert response.data['data']['thread_id'] is not None

    def test_cannot_book_unavailable_listing(self, auth_client, owner_user):
        from tests.factories import ListingFactory
        listing = ListingFactory(owner=owner_user, status='active', is_available=False)
        response = auth_client.post(self.URL, {
            'listing_id': str(listing.id),
            'start_date': str(date.today() + timedelta(days=5)),
            'end_date': str(date.today() + timedelta(days=10)),
            'duration_type': 'daily',
        }, format='json')
        assert response.status_code == 400

    def test_cannot_book_own_listing(self, dual_client, dual_user):
        from tests.factories import ListingFactory
        listing = ListingFactory(owner=dual_user, status='active', price_daily=50000)
        response = dual_client.post(self.URL, {
            'listing_id': str(listing.id),
            'start_date': str(date.today() + timedelta(days=5)),
            'end_date': str(date.today() + timedelta(days=10)),
            'duration_type': 'daily',
        }, format='json')
        assert response.status_code == 400

    def test_date_conflict_prevents_booking(self, auth_client, owner_user, renter_user):
        from tests.factories import ListingFactory, ConfirmedBookingFactory
        listing = ListingFactory(owner=owner_user, status='active', price_daily=50000)
        start = date.today() + timedelta(days=5)
        end = date.today() + timedelta(days=15)
        ConfirmedBookingFactory(
            renter=renter_user,
            owner=owner_user,
            listing=listing,
            start_date=start,
            end_date=end,
        )
        response = auth_client.post(self.URL, {
            'listing_id': str(listing.id),
            'start_date': str(start + timedelta(days=2)),
            'end_date': str(end - timedelta(days=2)),
            'duration_type': 'daily',
        }, format='json')
        assert response.status_code == 400

    def test_pending_booking_does_not_block_new_request(
        self, auth_client, owner_user, renter_user, create_user
    ):
        from tests.factories import ListingFactory, BookingFactory
        listing = ListingFactory(owner=owner_user, status='active', price_daily=50000)
        start = date.today() + timedelta(days=5)
        end = date.today() + timedelta(days=15)
        BookingFactory(
            renter=renter_user,
            owner=owner_user,
            listing=listing,
            start_date=start,
            end_date=end,
            status='pending',
        )
        second_renter = create_user(email='renter2@conflict.com', phone='08011119999')
        from rest_framework.test import APIClient
        client2 = APIClient()
        client2.force_authenticate(user=second_renter)
        response = client2.post('/api/v1/bookings/', {
            'listing_id': str(listing.id),
            'start_date': str(start + timedelta(days=2)),
            'end_date': str(end - timedelta(days=2)),
            'duration_type': 'daily',
        }, format='json')
        assert response.status_code == 201


@pytest.mark.django_db
class TestBookingStateTransitions:
    def test_owner_can_accept_pending_booking(self, owner_client, owner_user, renter_user):
        from tests.factories import ListingFactory, BookingFactory
        listing = ListingFactory(owner=owner_user)
        booking = BookingFactory(
            renter=renter_user, owner=owner_user, listing=listing, status='pending'
        )
        response = owner_client.patch(f'/api/v1/bookings/{booking.id}/accept/')
        assert response.status_code == 200
        booking.refresh_from_db()
        assert booking.status == 'confirmed'

    def test_accepting_makes_listing_unavailable(self, owner_client, owner_user, renter_user):
        from tests.factories import ListingFactory, BookingFactory
        listing = ListingFactory(owner=owner_user, is_available=True)
        booking = BookingFactory(
            renter=renter_user, owner=owner_user, listing=listing, status='pending'
        )
        owner_client.patch(f'/api/v1/bookings/{booking.id}/accept/')
        listing.refresh_from_db()
        assert listing.is_available is False

    def test_renter_cannot_accept_booking(self, auth_client, owner_user, renter_user):
        from tests.factories import ListingFactory, BookingFactory
        listing = ListingFactory(owner=owner_user)
        booking = BookingFactory(
            renter=renter_user, owner=owner_user, listing=listing, status='pending'
        )
        response = auth_client.patch(f'/api/v1/bookings/{booking.id}/accept/')
        assert response.status_code == 404

    def test_cannot_accept_confirmed_booking(self, owner_client, owner_user, renter_user):
        from tests.factories import ListingFactory, ConfirmedBookingFactory
        listing = ListingFactory(owner=owner_user)
        booking = ConfirmedBookingFactory(
            renter=renter_user, owner=owner_user, listing=listing
        )
        response = owner_client.patch(f'/api/v1/bookings/{booking.id}/accept/')
        assert response.status_code == 400

    def test_cannot_accept_overlapping_pending_after_first_confirmed(
        self, owner_client, owner_user, renter_user, create_user
    ):
        """Two overlapping pending requests: confirming one must block the other."""
        from rest_framework.test import APIClient
        from tests.factories import ListingFactory, BookingFactory

        listing = ListingFactory(owner=owner_user, is_available=True)
        start = date.today() + timedelta(days=20)
        end = date.today() + timedelta(days=30)
        booking_first = BookingFactory(
            renter=renter_user,
            owner=owner_user,
            listing=listing,
            start_date=start,
            end_date=end,
            status='pending',
        )
        renter_b = create_user(email='renter_b_overlap@test.com', phone='08011119997')
        client_b = APIClient()
        client_b.force_authenticate(user=renter_b)
        overlap_resp = client_b.post(
            '/api/v1/bookings/',
            {
                'listing_id': str(listing.id),
                'start_date': str(start + timedelta(days=2)),
                'end_date': str(end - timedelta(days=2)),
                'duration_type': 'daily',
            },
            format='json',
        )
        assert overlap_resp.status_code == 201
        booking_second_id = overlap_resp.data['data']['id']

        assert owner_client.patch(f'/api/v1/bookings/{booking_first.id}/accept/').status_code == 200

        second_accept = owner_client.patch(f'/api/v1/bookings/{booking_second_id}/accept/')
        assert second_accept.status_code == 400
        assert 'overlap' in second_accept.data['errors'].lower()

    def test_owner_can_decline_pending_booking(self, owner_client, owner_user, renter_user):
        from tests.factories import ListingFactory, BookingFactory
        listing = ListingFactory(owner=owner_user)
        booking = BookingFactory(
            renter=renter_user, owner=owner_user, listing=listing, status='pending'
        )
        response = owner_client.patch(
            f'/api/v1/bookings/{booking.id}/decline/',
            {'reason': 'Not available'},
        )
        assert response.status_code == 200
        booking.refresh_from_db()
        assert booking.status == 'declined'

    def test_renter_can_cancel_confirmed_booking(self, auth_client, owner_user, renter_user):
        from tests.factories import ListingFactory, ConfirmedBookingFactory
        listing = ListingFactory(owner=owner_user)
        booking = ConfirmedBookingFactory(
            renter=renter_user, owner=owner_user, listing=listing
        )
        response = auth_client.patch(
            f'/api/v1/bookings/{booking.id}/cancel/',
            {'reason': 'Plans changed'},
        )
        assert response.status_code == 200
        booking.refresh_from_db()
        assert booking.status in ('cancelled', 'cancelled_renter', 'cancelled_owner')

    def test_cancelling_restores_listing_availability(
        self, auth_client, owner_client, owner_user, renter_user
    ):
        from tests.factories import ListingFactory, ConfirmedBookingFactory
        listing = ListingFactory(owner=owner_user, is_available=False)
        booking = ConfirmedBookingFactory(
            renter=renter_user, owner=owner_user, listing=listing
        )
        auth_client.patch(f'/api/v1/bookings/{booking.id}/cancel/')
        listing.refresh_from_db()
        assert listing.is_available is True

    def test_mark_as_paid_simulated(self, auth_client, owner_user, renter_user, capsys):
        from tests.factories import ListingFactory, ConfirmedBookingFactory
        listing = ListingFactory(owner=owner_user)
        booking = ConfirmedBookingFactory(
            renter=renter_user, owner=owner_user, listing=listing
        )
        response = auth_client.patch(f'/api/v1/bookings/{booking.id}/pay/')
        assert response.status_code == 200
        booking.refresh_from_db()
        assert booking.payment_status == 'simulated_paid'
        captured = capsys.readouterr()
        assert '[DEV PAYMENT]' in captured.out

    def test_cannot_pay_pending_booking(self, auth_client, owner_user, renter_user):
        from tests.factories import ListingFactory, BookingFactory
        listing = ListingFactory(owner=owner_user)
        booking = BookingFactory(
            renter=renter_user, owner=owner_user, listing=listing, status='pending'
        )
        response = auth_client.patch(f'/api/v1/bookings/{booking.id}/pay/')
        assert response.status_code == 400

    def test_non_participant_cannot_view_booking(self, api_client, create_user, owner_user, renter_user):
        from tests.factories import ListingFactory, BookingFactory
        listing = ListingFactory(owner=owner_user)
        booking = BookingFactory(
            renter=renter_user, owner=owner_user, listing=listing
        )
        stranger = create_user(email='stranger@test.com', phone='08088888881')
        from rest_framework.test import APIClient
        client = APIClient()
        client.force_authenticate(user=stranger)
        response = client.get(f'/api/v1/bookings/{booking.id}/')
        assert response.status_code == 403
