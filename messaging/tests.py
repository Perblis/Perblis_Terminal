from datetime import date, timedelta
from decimal import Decimal

from django.test import TestCase
from django.contrib.auth import get_user_model
from django.contrib.gis.geos import Point
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from listings.models import Listing
from bookings.models import Booking
from messaging.models import Thread, Message
from messaging.services import get_or_create_booking_thread, get_or_create_inquiry_thread

User = get_user_model()


class MessagingServiceTest(TestCase):
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
            location=Point(3.3792, 6.5244),
        )

    def test_get_or_create_booking_thread(self):
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
        thread = get_or_create_booking_thread(booking)
        self.assertIsNotNone(thread)
        self.assertEqual(thread.booking, booking)
        self.assertEqual(thread.listing, self.listing)
        self.assertIn(self.renter, thread.participants.all())
        self.assertIn(self.owner, thread.participants.all())
        self.assertTrue(thread.is_booking_thread)

    def test_get_or_create_booking_thread_idempotent(self):
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
        thread1 = get_or_create_booking_thread(booking)
        thread2 = get_or_create_booking_thread(booking)
        self.assertEqual(thread1.id, thread2.id)
        self.assertEqual(Thread.objects.count(), 1)

    def test_get_or_create_inquiry_thread(self):
        thread, created = get_or_create_inquiry_thread(self.listing, self.renter)
        self.assertTrue(created)
        self.assertIsNone(thread.booking)
        self.assertEqual(thread.listing, self.listing)
        self.assertIn(self.renter, thread.participants.all())
        self.assertIn(self.owner, thread.participants.all())
        self.assertFalse(thread.is_booking_thread)

    def test_get_or_create_inquiry_thread_idempotent(self):
        thread1, created1 = get_or_create_inquiry_thread(self.listing, self.renter)
        thread2, created2 = get_or_create_inquiry_thread(self.listing, self.renter)
        self.assertTrue(created1)
        self.assertFalse(created2)
        self.assertEqual(thread1.id, thread2.id)


class MessagingAPITest(TestCase):
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
            location=Point(3.3792, 6.5244),
        )

        self.renter_client = APIClient()
        renter_token = RefreshToken.for_user(self.renter)
        self.renter_client.credentials(HTTP_AUTHORIZATION=f'Bearer {renter_token.access_token}')

        self.owner_client = APIClient()
        owner_token = RefreshToken.for_user(self.owner)
        self.owner_client.credentials(HTTP_AUTHORIZATION=f'Bearer {owner_token.access_token}')

    def test_create_inquiry_thread(self):
        data = {
            'listing_id': str(self.listing.id),
            'initial_message': 'Is this crane available next week?',
        }
        response = self.renter_client.post('/api/v1/threads/', data, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.data['success'])
        self.assertEqual(Thread.objects.count(), 1)
        self.assertEqual(Message.objects.count(), 1)

    def test_create_inquiry_own_listing(self):
        data = {
            'listing_id': str(self.listing.id),
            'initial_message': 'Hello',
        }
        response = self.owner_client.post('/api/v1/threads/', data, format='json')
        self.assertEqual(response.status_code, 400)

    def test_list_threads(self):
        thread, _ = get_or_create_inquiry_thread(self.listing, self.renter)
        Message.objects.create(thread=thread, sender=self.renter, body='Hello')

        response = self.renter_client.get('/api/v1/threads/')
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['success'])
        self.assertEqual(len(response.data['data']), 1)

    def test_thread_detail_marks_read(self):
        thread, _ = get_or_create_inquiry_thread(self.listing, self.renter)
        Message.objects.create(thread=thread, sender=self.owner, body='Hello renter')

        # Renter accesses thread, message from owner should be marked read
        response = self.renter_client.get(f'/api/v1/threads/{thread.id}/')
        self.assertEqual(response.status_code, 200)
        msg = Message.objects.first()
        self.assertTrue(msg.is_read)

    def test_send_message(self):
        thread, _ = get_or_create_inquiry_thread(self.listing, self.renter)

        data = {'body': 'When can I pick it up?'}
        response = self.renter_client.post(
            f'/api/v1/threads/{thread.id}/messages/', data, format='json'
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(Message.objects.count(), 1)
        self.assertEqual(Message.objects.first().body, 'When can I pick it up?')

    def test_non_participant_cannot_access(self):
        thread, _ = get_or_create_inquiry_thread(self.listing, self.renter)

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

        response = other_client.get(f'/api/v1/threads/{thread.id}/')
        self.assertEqual(response.status_code, 404)

    def test_ably_token_no_key(self):
        response = self.renter_client.post('/api/v1/threads/token/')
        self.assertEqual(response.status_code, 503)

    def test_booking_creates_thread(self):
        """When a booking is created via API, a thread is automatically created."""
        data = {
            'listing_id': str(self.listing.id),
            'start_date': str(date.today() + timedelta(days=1)),
            'end_date': str(date.today() + timedelta(days=5)),
            'duration_type': 'daily',
        }
        response = self.renter_client.post('/api/v1/bookings/', data, format='json')
        self.assertEqual(response.status_code, 201)
        # Verify thread was created
        self.assertEqual(Thread.objects.count(), 1)
        thread = Thread.objects.first()
        self.assertTrue(thread.is_booking_thread)
        self.assertIn(self.renter, thread.participants.all())
        self.assertIn(self.owner, thread.participants.all())
