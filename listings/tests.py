import uuid
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.contrib.gis.geos import Point
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APITestCase

from .models import Listing, ListingMedia, ResourceType, ListingStatus

User = get_user_model()


class ListingModelTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email='owner@test.com', password='TestPass123!',
            phone='08011111111', first_name='Owner', last_name='User',
            is_owner=True,
        )

    def test_create_listing(self):
        listing = Listing.objects.create(
            owner=self.owner,
            resource_type=ResourceType.EQUIPMENT,
            title='Test Crane',
            price_daily=Decimal('50000.00'),
            location=Point(3.3792, 6.5244, srid=4326),
            location_city='Lagos',
        )
        self.assertEqual(listing.status, ListingStatus.DRAFT)
        self.assertEqual(listing.verification_tier, 'basic')
        self.assertTrue(listing.is_available)
        self.assertEqual(listing.view_count, 0)

    def test_listing_lat_lng_properties(self):
        listing = Listing.objects.create(
            owner=self.owner,
            resource_type=ResourceType.WAREHOUSE,
            title='Test Warehouse',
            location=Point(3.3792, 6.5244, srid=4326),
        )
        self.assertAlmostEqual(listing.latitude, 6.5244)
        self.assertAlmostEqual(listing.longitude, 3.3792)

    def test_listing_without_location(self):
        listing = Listing.objects.create(
            owner=self.owner,
            resource_type=ResourceType.VEHICLE,
            title='Test Vehicle',
        )
        self.assertIsNone(listing.latitude)
        self.assertIsNone(listing.longitude)

    def test_listing_str(self):
        listing = Listing.objects.create(
            owner=self.owner,
            resource_type=ResourceType.TERMINAL,
            title='Container Yard',
        )
        self.assertIn('Container Yard', str(listing))
        self.assertIn('terminal', str(listing))


class ListingCreateTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email='owner@test.com', password='TestPass123!',
            phone='08011111111', first_name='Owner', last_name='User',
            is_owner=True, is_renter=True,
        )
        self.renter = User.objects.create_user(
            email='renter@test.com', password='TestPass123!',
            phone='08022222222', first_name='Renter', last_name='User',
            is_owner=False, is_renter=True,
        )

    def test_create_listing_as_owner(self):
        self.client.force_authenticate(user=self.owner)
        response = self.client.post('/api/v1/listings/', {
            'resource_type': 'equipment',
            'title': '50T Crane',
            'description': 'A big crane',
            'price_daily': '85000.00',
            'latitude': 6.5244,
            'longitude': 3.3792,
            'location_city': 'Lagos',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = response.json()
        self.assertTrue(data['success'])
        self.assertEqual(data['data']['title'], '50T Crane')
        self.assertEqual(data['data']['status'], 'draft')
        self.assertEqual(data['data']['verification_tier'], 'basic')
        self.assertAlmostEqual(float(data['data']['latitude']), 6.5244, places=3)
        self.assertAlmostEqual(float(data['data']['longitude']), 3.3792, places=3)

    def test_create_listing_as_renter_forbidden(self):
        self.client.force_authenticate(user=self.renter)
        response = self.client.post('/api/v1/listings/', {
            'resource_type': 'equipment',
            'title': 'Should Fail',
            'price_daily': '10000.00',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_create_listing_unauthenticated(self):
        response = self.client.post('/api/v1/listings/', {
            'resource_type': 'equipment',
            'title': 'Unauth',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_create_listing_all_resource_types(self):
        self.client.force_authenticate(user=self.owner)
        for rt in ['equipment', 'vehicle', 'warehouse', 'terminal', 'facility']:
            response = self.client.post('/api/v1/listings/', {
                'resource_type': rt,
                'title': f'Test {rt}',
                'price_daily': '10000.00',
            }, format='json')
            self.assertEqual(response.status_code, status.HTTP_201_CREATED, f"Failed for {rt}")


class ListingListTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email='owner@test.com', password='TestPass123!',
            phone='08011111111', first_name='Owner', last_name='User',
            is_owner=True,
        )
        self.other = User.objects.create_user(
            email='other@test.com', password='TestPass123!',
            phone='08022222222', first_name='Other', last_name='User',
            is_owner=True,
        )
        Listing.objects.create(owner=self.owner, resource_type='equipment', title='My Crane')
        Listing.objects.create(owner=self.owner, resource_type='vehicle', title='My Truck')
        Listing.objects.create(owner=self.other, resource_type='warehouse', title='Other Warehouse')

    def test_list_returns_only_own_listings(self):
        self.client.force_authenticate(user=self.owner)
        response = self.client.get('/api/v1/listings/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(len(data['data']), 2)

    def test_list_returns_empty_for_user_without_listings(self):
        new_user = User.objects.create_user(
            email='new@test.com', password='TestPass123!',
            phone='08033333333', is_owner=True,
        )
        self.client.force_authenticate(user=new_user)
        response = self.client.get('/api/v1/listings/')
        self.assertEqual(len(response.json()['data']), 0)


class ListingDetailTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email='owner@test.com', password='TestPass123!',
            phone='08011111111', first_name='Owner', last_name='User',
            is_owner=True,
        )
        self.other_user = User.objects.create_user(
            email='other@test.com', password='TestPass123!',
            phone='08022222222', first_name='Other', last_name='User',
        )
        self.listing = Listing.objects.create(
            owner=self.owner,
            resource_type='equipment',
            title='Detail Crane',
            price_daily=Decimal('50000.00'),
            location=Point(3.3792, 6.5244, srid=4326),
            location_city='Lagos',
        )

    def test_get_detail_increments_view_count(self):
        self.client.force_authenticate(user=self.other_user)
        self.assertEqual(self.listing.view_count, 0)
        response = self.client.get(f'/api/v1/listings/{self.listing.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()['data']['view_count'], 1)

    def test_patch_listing_as_owner(self):
        self.client.force_authenticate(user=self.owner)
        response = self.client.patch(f'/api/v1/listings/{self.listing.id}/', {
            'title': 'Updated Crane',
            'price_daily': '90000.00',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()['data']['title'], 'Updated Crane')

    def test_patch_listing_as_non_owner_forbidden(self):
        self.client.force_authenticate(user=self.other_user)
        response = self.client.patch(f'/api/v1/listings/{self.listing.id}/', {
            'title': 'Hacked',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_delete_archives_listing(self):
        self.client.force_authenticate(user=self.owner)
        response = self.client.delete(f'/api/v1/listings/{self.listing.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.listing.refresh_from_db()
        self.assertEqual(self.listing.status, 'archived')

    def test_delete_as_non_owner_forbidden(self):
        self.client.force_authenticate(user=self.other_user)
        response = self.client.delete(f'/api/v1/listings/{self.listing.id}/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_get_nonexistent_listing(self):
        self.client.force_authenticate(user=self.owner)
        response = self.client.get(f'/api/v1/listings/{uuid.uuid4()}/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class ListingStatusTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email='owner@test.com', password='TestPass123!',
            phone='08011111111', is_owner=True,
        )
        self.listing = Listing.objects.create(
            owner=self.owner,
            resource_type='equipment',
            title='Status Test',
            price_daily=Decimal('50000.00'),
            location=Point(3.3792, 6.5244, srid=4326),
        )
        self.client.force_authenticate(user=self.owner)

    def test_cannot_activate_without_photo(self):
        response = self.client.patch(f'/api/v1/listings/{self.listing.id}/status/', {
            'status': 'active',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cannot_activate_without_location(self):
        listing_no_loc = Listing.objects.create(
            owner=self.owner,
            resource_type='vehicle',
            title='No Location',
        )
        ListingMedia.objects.create(
            listing=listing_no_loc,
            file=SimpleUploadedFile("test.jpg", b"img", content_type="image/jpeg"),
            is_primary=True,
        )
        response = self.client.patch(f'/api/v1/listings/{listing_no_loc.id}/status/', {
            'status': 'active',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_activate_with_location_and_photo(self):
        ListingMedia.objects.create(
            listing=self.listing,
            file=SimpleUploadedFile("test.jpg", b"img", content_type="image/jpeg"),
            is_primary=True,
        )
        response = self.client.patch(f'/api/v1/listings/{self.listing.id}/status/', {
            'status': 'active',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.listing.refresh_from_db()
        self.assertEqual(self.listing.status, 'active')

    def test_pause_listing(self):
        self.listing.status = 'active'
        self.listing.save()
        response = self.client.patch(f'/api/v1/listings/{self.listing.id}/status/', {
            'status': 'paused',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.listing.refresh_from_db()
        self.assertEqual(self.listing.status, 'paused')


class MediaUploadTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email='owner@test.com', password='TestPass123!',
            phone='08011111111', is_owner=True,
        )
        self.other = User.objects.create_user(
            email='other@test.com', password='TestPass123!',
            phone='08022222222',
        )
        self.listing = Listing.objects.create(
            owner=self.owner,
            resource_type='equipment',
            title='Media Test',
        )
        self.client.force_authenticate(user=self.owner)

    def test_upload_first_photo_is_primary(self):
        img = SimpleUploadedFile("photo1.jpg", b"image data", content_type="image/jpeg")
        response = self.client.post(
            f'/api/v1/listings/{self.listing.id}/media/',
            {'file': img},
            format='multipart',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.json()['data']['is_primary'])

    def test_upload_second_photo_not_primary(self):
        ListingMedia.objects.create(
            listing=self.listing,
            file=SimpleUploadedFile("p1.jpg", b"img", content_type="image/jpeg"),
            is_primary=True,
        )
        img = SimpleUploadedFile("photo2.jpg", b"image data 2", content_type="image/jpeg")
        response = self.client.post(
            f'/api/v1/listings/{self.listing.id}/media/',
            {'file': img},
            format='multipart',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertFalse(response.json()['data']['is_primary'])

    def test_upload_without_file(self):
        response = self.client.post(
            f'/api/v1/listings/{self.listing.id}/media/',
            {},
            format='multipart',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_upload_by_non_owner_forbidden(self):
        self.client.force_authenticate(user=self.other)
        img = SimpleUploadedFile("photo.jpg", b"data", content_type="image/jpeg")
        response = self.client.post(
            f'/api/v1/listings/{self.listing.id}/media/',
            {'file': img},
            format='multipart',
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_delete_media(self):
        media = ListingMedia.objects.create(
            listing=self.listing,
            file=SimpleUploadedFile("del.jpg", b"img", content_type="image/jpeg"),
            is_primary=True,
        )
        response = self.client.delete(
            f'/api/v1/listings/{self.listing.id}/media/{media.id}/'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(ListingMedia.objects.filter(id=media.id).exists())


class ListingReportTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email='owner@test.com', password='TestPass123!',
            phone='08011111111', is_owner=True,
        )
        self.reporter = User.objects.create_user(
            email='reporter@test.com', password='TestPass123!',
            phone='08022222222',
        )
        self.listing = Listing.objects.create(
            owner=self.owner,
            resource_type='equipment',
            title='Reported Listing',
            status='active',
        )

    def test_report_listing_success(self):
        self.client.force_authenticate(user=self.reporter)
        response = self.client.post(f'/api/v1/listings/{self.listing.id}/report/', {
            'reason': 'fake',
            'description': 'This looks suspicious',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.json()['success'])

    def test_cannot_report_own_listing(self):
        self.client.force_authenticate(user=self.owner)
        response = self.client.post(f'/api/v1/listings/{self.listing.id}/report/', {
            'reason': 'spam',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cannot_report_twice(self):
        self.client.force_authenticate(user=self.reporter)
        self.client.post(f'/api/v1/listings/{self.listing.id}/report/', {
            'reason': 'fake',
        }, format='json')
        response = self.client.post(f'/api/v1/listings/{self.listing.id}/report/', {
            'reason': 'spam',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class MapSearchTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email='owner@test.com', password='TestPass123!',
            phone='08011111111', is_owner=True,
        )
        # Lagos Island: 6.5244, 3.3792
        self.listing1 = Listing.objects.create(
            owner=self.owner,
            resource_type='equipment',
            title='Crane Lagos Island',
            status='active',
            is_available=True,
            location=Point(3.3792, 6.5244, srid=4326),
            location_city='Lagos',
            price_daily=Decimal('50000.00'),
        )
        # Apapa: 6.4698, 3.3547
        self.listing2 = Listing.objects.create(
            owner=self.owner,
            resource_type='vehicle',
            title='Truck Apapa',
            status='active',
            is_available=True,
            location=Point(3.3547, 6.4698, srid=4326),
            location_city='Lagos',
            price_daily=Decimal('30000.00'),
        )
        # Draft listing (should not appear)
        self.draft = Listing.objects.create(
            owner=self.owner,
            resource_type='warehouse',
            title='Draft Warehouse',
            status='draft',
            location=Point(3.3792, 6.5244, srid=4326),
        )
        # Listing without location (should not appear)
        self.no_location = Listing.objects.create(
            owner=self.owner,
            resource_type='facility',
            title='No Location',
            status='active',
        )

    def test_search_returns_active_listings(self):
        response = self.client.get('/api/v1/search/map/?lat=6.5244&lng=3.3792')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertTrue(data['success'])
        self.assertEqual(data['count'], 2)

    def test_search_ordered_by_distance(self):
        response = self.client.get('/api/v1/search/map/?lat=6.5244&lng=3.3792')
        data = response.json()['data']
        self.assertEqual(data[0]['title'], 'Crane Lagos Island')
        distances = [item['distance_km'] for item in data]
        self.assertEqual(distances, sorted(distances))

    def test_search_distance_km_is_rounded(self):
        response = self.client.get('/api/v1/search/map/?lat=6.5244&lng=3.3792')
        data = response.json()['data']
        for item in data:
            if item['distance_km'] is not None:
                str_val = str(item['distance_km'])
                if '.' in str_val:
                    decimal_places = len(str_val.split('.')[1])
                    self.assertLessEqual(decimal_places, 2)

    def test_search_filter_by_resource_type(self):
        response = self.client.get('/api/v1/search/map/?lat=6.5244&lng=3.3792&resource_type=equipment')
        data = response.json()
        self.assertEqual(data['count'], 1)
        self.assertEqual(data['data'][0]['resource_type'], 'equipment')

    def test_search_filter_by_invalid_resource_type(self):
        response = self.client.get('/api/v1/search/map/?lat=6.5244&lng=3.3792&resource_type=invalid')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_search_respects_radius(self):
        response = self.client.get('/api/v1/search/map/?lat=6.5244&lng=3.3792&radius=1')
        data = response.json()
        self.assertLessEqual(data['count'], 1)

    def test_search_missing_lat(self):
        response = self.client.get('/api/v1/search/map/?lng=3.3792')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_search_missing_lng(self):
        response = self.client.get('/api/v1/search/map/?lat=6.5244')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_search_invalid_coordinates(self):
        response = self.client.get('/api/v1/search/map/?lat=999&lng=3.3792')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_search_invalid_lat_value(self):
        response = self.client.get('/api/v1/search/map/?lat=abc&lng=3.3792')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_search_does_not_return_drafts(self):
        response = self.client.get('/api/v1/search/map/?lat=6.5244&lng=3.3792')
        titles = [item['title'] for item in response.json()['data']]
        self.assertNotIn('Draft Warehouse', titles)

    def test_search_does_not_return_listings_without_location(self):
        response = self.client.get('/api/v1/search/map/?lat=6.5244&lng=3.3792')
        titles = [item['title'] for item in response.json()['data']]
        self.assertNotIn('No Location', titles)

    def test_search_no_auth_required(self):
        response = self.client.get('/api/v1/search/map/?lat=6.5244&lng=3.3792')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_search_unavailable_listing_filtered(self):
        self.listing1.is_available = False
        self.listing1.save()
        response = self.client.get('/api/v1/search/map/?lat=6.5244&lng=3.3792')
        self.assertEqual(response.json()['count'], 1)

    def test_search_available_param_false_includes_unavailable(self):
        self.listing1.is_available = False
        self.listing1.save()
        response = self.client.get('/api/v1/search/map/?lat=6.5244&lng=3.3792&available=false')
        self.assertEqual(response.json()['count'], 2)
