import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.contrib.gis.geos import Point
from rest_framework.views import APIView

from listings.models import Listing, ListingReport
from listings.views import listing_list_create


def test_listing_list_create_is_drf_api_view():
    """Without @api_view, JWT auth and permissions do not run; owner filter can 500."""
    assert hasattr(listing_list_create, 'cls')
    assert issubclass(listing_list_create.cls, APIView)


@pytest.mark.django_db
class TestListingListCreate:
    URL = '/api/v1/listings/'

    def test_unauthenticated_cannot_list(self, api_client):
        response = api_client.get(self.URL)
        assert response.status_code == 401

    def test_owner_gets_own_listings_only(self, owner_client, owner_user, second_owner_user):
        from tests.factories import ListingFactory
        ListingFactory(owner=owner_user)
        ListingFactory(owner=owner_user)
        ListingFactory(owner=second_owner_user)
        response = owner_client.get(self.URL)
        assert response.status_code == 200
        assert response.data['count'] == 2

    def test_response_is_paginated(self, owner_client):
        response = owner_client.get(self.URL)
        assert 'count' in response.data
        assert 'next' in response.data
        assert 'previous' in response.data
        assert 'results' in response.data

    def test_filter_by_status(self, owner_client, owner_user):
        from tests.factories import ListingFactory
        ListingFactory(owner=owner_user, status='active')
        ListingFactory(owner=owner_user, status='paused')
        response = owner_client.get(f'{self.URL}?status=active')
        assert response.data['count'] == 1

    def test_filter_by_resource_type(self, owner_client, owner_user):
        from tests.factories import ListingFactory, WarehouseListingFactory
        ListingFactory(owner=owner_user, resource_type='equipment')
        WarehouseListingFactory(owner=owner_user, resource_type='warehouse')
        response = owner_client.get(f'{self.URL}?resource_type=equipment')
        assert response.data['count'] == 1

    def test_ordering_by_view_count(self, owner_client, owner_user):
        from tests.factories import ListingFactory
        l1 = ListingFactory(owner=owner_user, view_count=10)
        l2 = ListingFactory(owner=owner_user, view_count=50)
        l3 = ListingFactory(owner=owner_user, view_count=5)
        response = owner_client.get(f'{self.URL}?ordering=-view_count')
        results = response.data['results']
        assert str(l2.id) == results[0]['id']
        assert str(l1.id) == results[1]['id']
        assert str(l3.id) == results[2]['id']

    def test_non_owner_cannot_create_listing(self, auth_client):
        response = auth_client.post(self.URL, {
            'resource_type': 'equipment',
            'title': 'Should Fail',
        })
        assert response.status_code == 403

    def test_owner_can_create_listing(self, owner_client):
        response = owner_client.post(self.URL, {
            'resource_type': 'equipment',
            'title': 'New Crane',
            'price_daily': 50000,
            'latitude': 6.5244,
            'longitude': 3.3792,
        }, format='json')
        assert response.status_code == 201
        assert response.data['data']['title'] == 'New Crane'
        assert response.data['data']['status'] == 'draft'

    def test_create_listing_without_location_creates_draft(self, owner_client):
        response = owner_client.post(self.URL, {
            'resource_type': 'warehouse',
            'title': 'No Location Warehouse',
            'price_monthly': 2000000,
        }, format='json')
        assert response.status_code == 201
        assert response.data['data']['latitude'] is None


@pytest.mark.django_db
class TestListingDetail:
    def test_public_can_view_active_listing(self, api_client):
        from tests.factories import ListingFactory
        listing = ListingFactory(status='active')
        response = api_client.get(f'/api/v1/listings/{listing.id}/')
        assert response.status_code == 200

    def test_view_increments_view_count(self, api_client):
        from tests.factories import ListingFactory
        listing = ListingFactory(status='active', view_count=0)
        api_client.get(f'/api/v1/listings/{listing.id}/')
        listing.refresh_from_db()
        assert listing.view_count == 1

    def test_owner_can_update_own_listing(self, owner_client, owner_user):
        from tests.factories import ListingFactory
        listing = ListingFactory(owner=owner_user)
        response = owner_client.patch(
            f'/api/v1/listings/{listing.id}/',
            {'title': 'Updated Title'},
            format='json',
        )
        assert response.status_code == 200

    def test_non_owner_cannot_update_listing(self, auth_client):
        from tests.factories import ListingFactory
        listing = ListingFactory()
        response = auth_client.patch(
            f'/api/v1/listings/{listing.id}/',
            {'title': 'Hacked Title'},
        )
        assert response.status_code == 403

    def test_delete_archives_listing(self, owner_client, owner_user):
        from tests.factories import ListingFactory
        listing = ListingFactory(owner=owner_user, status='active')
        response = owner_client.delete(f'/api/v1/listings/{listing.id}/')
        assert response.status_code == 200
        listing.refresh_from_db()
        assert listing.status == 'archived'

    def test_cannot_activate_listing_without_location(self, owner_client, owner_user):
        from tests.factories import ListingFactory
        listing = ListingFactory(owner=owner_user, location=None, status='draft')
        response = owner_client.patch(
            f'/api/v1/listings/{listing.id}/status/',
            {'status': 'active'},
        )
        assert response.status_code == 400

    def test_nonexistent_listing_returns_404(self, api_client):
        import uuid
        response = api_client.get(f'/api/v1/listings/{uuid.uuid4()}/')
        assert response.status_code == 404


@pytest.mark.django_db
class TestListingMedia:
    def test_upload_photo(self, owner_client, owner_user):
        from tests.factories import ListingFactory
        listing = ListingFactory(owner=owner_user)
        photo = SimpleUploadedFile('test.jpg', b'imgcontent', content_type='image/jpeg')
        response = owner_client.post(
            f'/api/v1/listings/{listing.id}/media/',
            {'file': photo},
            format='multipart',
        )
        assert response.status_code == 201
        assert response.data['data']['is_primary'] is True

    def test_first_photo_is_auto_primary(self, owner_client, owner_user):
        from tests.factories import ListingFactory
        listing = ListingFactory(owner=owner_user)
        for i in range(3):
            photo = SimpleUploadedFile(f'test{i}.jpg', b'content', content_type='image/jpeg')
            owner_client.post(
                f'/api/v1/listings/{listing.id}/media/',
                {'file': photo},
                format='multipart',
            )
        from listings.models import ListingMedia
        assert ListingMedia.objects.filter(listing=listing, is_primary=True).count() == 1

    def test_non_owner_cannot_upload(self, auth_client):
        from tests.factories import ListingFactory
        listing = ListingFactory()
        photo = SimpleUploadedFile('test.jpg', b'content', content_type='image/jpeg')
        response = auth_client.post(
            f'/api/v1/listings/{listing.id}/media/',
            {'file': photo},
            format='multipart',
        )
        assert response.status_code == 403


@pytest.mark.django_db
class TestListingReport:
    def test_renter_can_report_listing(self, auth_client):
        from tests.factories import ListingFactory
        listing = ListingFactory(status='active')
        response = auth_client.post(
            f'/api/v1/listings/{listing.id}/report/',
            {'reason': 'fake', 'description': 'This is fake'},
        )
        assert response.status_code == 201

    def test_cannot_report_own_listing(self, owner_client, owner_user):
        from tests.factories import ListingFactory
        listing = ListingFactory(owner=owner_user)
        response = owner_client.post(
            f'/api/v1/listings/{listing.id}/report/',
            {'reason': 'spam'},
        )
        assert response.status_code == 400

    def test_cannot_report_twice(self, auth_client):
        from tests.factories import ListingFactory
        listing = ListingFactory(status='active')
        auth_client.post(f'/api/v1/listings/{listing.id}/report/', {'reason': 'fake'})
        response = auth_client.post(f'/api/v1/listings/{listing.id}/report/', {'reason': 'fake'})
        assert response.status_code == 400
