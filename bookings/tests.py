from datetime import date, timedelta
from decimal import Decimal

from django.test import TestCase
from django.contrib.auth import get_user_model
from django.contrib.gis.geos import Point
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from listings.models import Listing
from bookings.models import Booking, BookingStatus, PaymentStatus
from messaging.models import Thread

User = get_user_model()


class BookingModelTest(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email='owner@test.com',
            password='testpass123',
            phone='+2341111111111',
            first_name='Owner',
            last_name='User',
            is_owner=True,
        )
        self.renter = User.objects.create_user(
            email='renter@test.com',
            password='testpass123',
            phone='+2342222222222',
            first_name='Renter',
            last_name='User',
            is_renter=True,
        )
        self.listing = Listing.objects.create(
            owner=self.owner,
            title='Test Crane',
            resource_type='equipment',
            status='active',
            is_available=True,
            price_daily=Decimal('50000.00'),
            price_weekly=Decimal('300000.00'),
            location=Point(3.3792, 6.5244),
        )

    def test_create_booking(self):
        booking = Booking.objects.create(
            renter=self.renter,
            owner=self.owner,
            listing=self.listing,
            start_date=date.today() + timedelta(days=1),
            end_date=date.today() + timedelta(days=5),
            duration_type='daily',
            gross_amount=Decimal('200000.00'),
            commission_amount=Decimal('20000.00'),
            owner_payout_amount=Decimal('180000.00'),
        )
        self.assertEqual(booking.status, BookingStatus.PENDING)
        self.assertEqual(booking.payment_status, PaymentStatus.UNPAID)
        self.assertEqual(booking.duration_days, 4)

    def test_booking_str(self):
        booking = Booking.objects.create(
            renter=self.renter,
            owner=self.owner,
            listing=self.listing,
            start_date=date.today() + timedelta(days=1),
            end_date=date.today() + timedelta(days=5),
            duration_type='daily',
            gross_amount=Decimal('200000.00'),
            commission_amount=Decimal('20000.00'),
            owner_payout_amount=Decimal('180000.00'),
        )
        self.assertIn('Test Crane', str(booking))
        self.assertIn('renter@test.com', str(booking))


class BookingAPITest(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email='owner@test.com',
            password='testpass123',
            phone='+2341111111111',
            first_name='Owner',
            last_name='User',
            is_owner=True,
            is_renter=False,
        )
        self.renter = User.objects.create_user(
            email='renter@test.com',
            password='testpass123',
            phone='+2342222222222',
            first_name='Renter',
            last_name='User',
            is_renter=True,
        )
        self.listing = Listing.objects.create(
            owner=self.owner,
            title='Test Crane',
            resource_type='equipment',
            status='active',
            is_available=True,
            price_daily=Decimal('50000.00'),
            price_weekly=Decimal('300000.00'),
            location=Point(3.3792, 6.5244),
        )

        self.renter_client = APIClient()
        renter_token = RefreshToken.for_user(self.renter)
        self.renter_client.credentials(HTTP_AUTHORIZATION=f'Bearer {renter_token.access_token}')

        self.owner_client = APIClient()
        owner_token = RefreshToken.for_user(self.owner)
        self.owner_client.credentials(HTTP_AUTHORIZATION=f'Bearer {owner_token.access_token}')

    def test_create_booking_success(self):
        data = {
            'listing_id': str(self.listing.id),
            'start_date': str(date.today() + timedelta(days=1)),
            'end_date': str(date.today() + timedelta(days=5)),
            'duration_type': 'daily',
            'renter_note': 'Need it for construction site',
        }
        response = self.renter_client.post('/api/v1/bookings/', data, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.data['success'])
        self.assertEqual(response.data['data']['status'], 'pending')
        # Thread should be auto-created
        self.assertEqual(Thread.objects.count(), 1)

    def test_create_booking_past_start_date(self):
        data = {
            'listing_id': str(self.listing.id),
            'start_date': str(date.today() - timedelta(days=1)),
            'end_date': str(date.today() + timedelta(days=5)),
            'duration_type': 'daily',
        }
        response = self.renter_client.post('/api/v1/bookings/', data, format='json')
        self.assertEqual(response.status_code, 400)

    def test_create_booking_own_listing(self):
        data = {
            'listing_id': str(self.listing.id),
            'start_date': str(date.today() + timedelta(days=1)),
            'end_date': str(date.today() + timedelta(days=5)),
            'duration_type': 'daily',
        }
        response = self.owner_client.post('/api/v1/bookings/', data, format='json')
        # Owner is not a renter, so should get 403
        self.assertEqual(response.status_code, 403)

    def test_create_booking_date_conflict(self):
        # Create a confirmed booking
        Booking.objects.create(
            renter=self.renter,
            owner=self.owner,
            listing=self.listing,
            start_date=date.today() + timedelta(days=1),
            end_date=date.today() + timedelta(days=5),
            duration_type='daily',
            status=BookingStatus.CONFIRMED,
            gross_amount=Decimal('200000.00'),
            commission_amount=Decimal('20000.00'),
            owner_payout_amount=Decimal('180000.00'),
        )
        # Try overlapping booking
        data = {
            'listing_id': str(self.listing.id),
            'start_date': str(date.today() + timedelta(days=3)),
            'end_date': str(date.today() + timedelta(days=7)),
            'duration_type': 'daily',
        }
        response = self.renter_client.post('/api/v1/bookings/', data, format='json')
        self.assertEqual(response.status_code, 400)

    def test_pending_bookings_dont_block(self):
        # Create a pending booking (should NOT block)
        Booking.objects.create(
            renter=self.renter,
            owner=self.owner,
            listing=self.listing,
            start_date=date.today() + timedelta(days=1),
            end_date=date.today() + timedelta(days=5),
            duration_type='daily',
            status=BookingStatus.PENDING,
            gross_amount=Decimal('200000.00'),
            commission_amount=Decimal('20000.00'),
            owner_payout_amount=Decimal('180000.00'),
        )
        # Overlapping request should succeed
        data = {
            'listing_id': str(self.listing.id),
            'start_date': str(date.today() + timedelta(days=3)),
            'end_date': str(date.today() + timedelta(days=7)),
            'duration_type': 'daily',
        }
        response = self.renter_client.post('/api/v1/bookings/', data, format='json')
        self.assertEqual(response.status_code, 201)

    def test_accept_booking(self):
        booking = Booking.objects.create(
            renter=self.renter,
            owner=self.owner,
            listing=self.listing,
            start_date=date.today() + timedelta(days=1),
            end_date=date.today() + timedelta(days=5),
            duration_type='daily',
            gross_amount=Decimal('200000.00'),
            commission_amount=Decimal('20000.00'),
            owner_payout_amount=Decimal('180000.00'),
        )
        response = self.owner_client.patch(f'/api/v1/bookings/{booking.id}/accept/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['data']['status'], 'confirmed')

    def test_decline_booking(self):
        booking = Booking.objects.create(
            renter=self.renter,
            owner=self.owner,
            listing=self.listing,
            start_date=date.today() + timedelta(days=1),
            end_date=date.today() + timedelta(days=5),
            duration_type='daily',
            gross_amount=Decimal('200000.00'),
            commission_amount=Decimal('20000.00'),
            owner_payout_amount=Decimal('180000.00'),
        )
        response = self.owner_client.patch(
            f'/api/v1/bookings/{booking.id}/decline/',
            {'reason': 'Not available'},
            format='json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['data']['status'], 'declined')

    def test_cancel_booking_by_renter(self):
        booking = Booking.objects.create(
            renter=self.renter,
            owner=self.owner,
            listing=self.listing,
            start_date=date.today() + timedelta(days=1),
            end_date=date.today() + timedelta(days=5),
            duration_type='daily',
            gross_amount=Decimal('200000.00'),
            commission_amount=Decimal('20000.00'),
            owner_payout_amount=Decimal('180000.00'),
        )
        response = self.renter_client.patch(
            f'/api/v1/bookings/{booking.id}/cancel/',
            {'reason': 'Changed plans'},
            format='json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['data']['status'], 'cancelled')

    def test_mark_paid(self):
        booking = Booking.objects.create(
            renter=self.renter,
            owner=self.owner,
            listing=self.listing,
            start_date=date.today() + timedelta(days=1),
            end_date=date.today() + timedelta(days=5),
            duration_type='daily',
            status=BookingStatus.CONFIRMED,
            gross_amount=Decimal('200000.00'),
            commission_amount=Decimal('20000.00'),
            owner_payout_amount=Decimal('180000.00'),
        )
        response = self.renter_client.patch(f'/api/v1/bookings/{booking.id}/pay/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['data']['payment_status'], 'simulated_paid')

    def test_mark_paid_only_confirmed(self):
        booking = Booking.objects.create(
            renter=self.renter,
            owner=self.owner,
            listing=self.listing,
            start_date=date.today() + timedelta(days=1),
            end_date=date.today() + timedelta(days=5),
            duration_type='daily',
            status=BookingStatus.PENDING,
            gross_amount=Decimal('200000.00'),
            commission_amount=Decimal('20000.00'),
            owner_payout_amount=Decimal('180000.00'),
        )
        response = self.renter_client.patch(f'/api/v1/bookings/{booking.id}/pay/')
        self.assertEqual(response.status_code, 400)

    def test_list_bookings_renter(self):
        Booking.objects.create(
            renter=self.renter,
            owner=self.owner,
            listing=self.listing,
            start_date=date.today() + timedelta(days=1),
            end_date=date.today() + timedelta(days=5),
            duration_type='daily',
            gross_amount=Decimal('200000.00'),
            commission_amount=Decimal('20000.00'),
            owner_payout_amount=Decimal('180000.00'),
        )
        response = self.renter_client.get('/api/v1/bookings/?role=renter')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['count'], 1)

    def test_list_bookings_owner(self):
        Booking.objects.create(
            renter=self.renter,
            owner=self.owner,
            listing=self.listing,
            start_date=date.today() + timedelta(days=1),
            end_date=date.today() + timedelta(days=5),
            duration_type='daily',
            gross_amount=Decimal('200000.00'),
            commission_amount=Decimal('20000.00'),
            owner_payout_amount=Decimal('180000.00'),
        )
        response = self.owner_client.get('/api/v1/bookings/?role=owner')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['count'], 1)

    def test_booking_detail_forbidden(self):
        booking = Booking.objects.create(
            renter=self.renter,
            owner=self.owner,
            listing=self.listing,
            start_date=date.today() + timedelta(days=1),
            end_date=date.today() + timedelta(days=5),
            duration_type='daily',
            gross_amount=Decimal('200000.00'),
            commission_amount=Decimal('20000.00'),
            owner_payout_amount=Decimal('180000.00'),
        )
        # Third party user
        other_user = User.objects.create_user(
            email='other@test.com',
            password='testpass123',
            phone='+2343333333333',
            first_name='Other',
            last_name='User',
        )
        other_client = APIClient()
        other_token = RefreshToken.for_user(other_user)
        other_client.credentials(HTTP_AUTHORIZATION=f'Bearer {other_token.access_token}')
        response = other_client.get(f'/api/v1/bookings/{booking.id}/')
        self.assertEqual(response.status_code, 403)
