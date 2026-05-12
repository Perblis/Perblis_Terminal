import pytest
from django.contrib.gis.geos import Point
from listings.serializers import CreateListingSerializer, UpdateListingStatusSerializer
from listings.models import Listing


@pytest.mark.django_db
class TestCreateListingSerializer:
    def test_valid_data_creates_point(self, owner_user):
        data = {
            'resource_type': 'equipment',
            'title': 'Test Crane',
            'price_daily': 50000,
            'latitude': 6.5244,
            'longitude': 3.3792,
        }
        serializer = CreateListingSerializer(data=data)
        assert serializer.is_valid(), serializer.errors
        assert 'location' in serializer.validated_data
        assert isinstance(serializer.validated_data['location'], Point)

    def test_no_lat_lng_leaves_location_unset(self):
        data = {
            'resource_type': 'equipment',
            'title': 'No Location Crane',
            'price_daily': 50000,
        }
        serializer = CreateListingSerializer(data=data)
        assert serializer.is_valid(), serializer.errors
        assert 'location' not in serializer.validated_data

    def test_invalid_resource_type_fails(self):
        data = {
            'resource_type': 'invalid_type',
            'title': 'Bad Type',
        }
        serializer = CreateListingSerializer(data=data)
        assert not serializer.is_valid()
        assert 'resource_type' in serializer.errors


@pytest.mark.django_db
class TestUpdateListingStatusSerializer:
    def test_cannot_activate_without_location(self, owner_user):
        from tests.factories import ListingFactory
        listing = ListingFactory(owner=owner_user, location=None, status='draft')
        serializer = UpdateListingStatusSerializer(
            listing, data={'status': 'active'}, partial=True
        )
        assert not serializer.is_valid()
        assert 'status' in serializer.errors

    def test_cannot_activate_without_photos(self, owner_user):
        from django.contrib.gis.geos import Point
        from tests.factories import ListingFactory
        listing = ListingFactory(
            owner=owner_user,
            location=Point(3.3792, 6.5244, srid=4326),
            status='draft',
        )
        serializer = UpdateListingStatusSerializer(
            listing, data={'status': 'active'}, partial=True
        )
        assert not serializer.is_valid()

    def test_can_pause_active_listing(self, owner_user):
        from tests.factories import ListingFactory
        listing = ListingFactory(owner=owner_user, status='active')
        serializer = UpdateListingStatusSerializer(
            listing, data={'status': 'paused'}, partial=True
        )
        assert serializer.is_valid(), serializer.errors
