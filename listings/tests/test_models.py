import pytest
from django.contrib.gis.geos import Point
from listings.models import Listing, ListingMedia, ListingStatus, ResourceType


@pytest.mark.django_db
class TestListingModel:
    def test_listing_str(self, owner_user):
        listing = Listing.objects.create(
            owner=owner_user,
            resource_type=ResourceType.EQUIPMENT,
            title='Test Crane',
            status='draft',
        )
        assert 'Test Crane' in str(listing)
        assert 'equipment' in str(listing)

    def test_primary_photo_url_returns_none_with_no_media(self, owner_user):
        listing = Listing.objects.create(
            owner=owner_user,
            resource_type='equipment',
            title='No Photo',
            status='draft',
        )
        assert listing.primary_photo_url is None

    def test_latitude_longitude_from_point(self, owner_user):
        listing = Listing.objects.create(
            owner=owner_user,
            resource_type='equipment',
            title='Located Listing',
            location=Point(3.3792, 6.5244, srid=4326),
            status='draft',
        )
        assert listing.latitude == pytest.approx(6.5244, abs=0.001)
        assert listing.longitude == pytest.approx(3.3792, abs=0.001)

    def test_latitude_longitude_none_without_location(self, owner_user):
        listing = Listing.objects.create(
            owner=owner_user,
            resource_type='equipment',
            title='No Location',
            status='draft',
        )
        assert listing.latitude is None
        assert listing.longitude is None

    def test_listing_default_verification_tier_is_basic(self, owner_user):
        listing = Listing.objects.create(
            owner=owner_user,
            resource_type='equipment',
            title='Basic Listing',
            status='draft',
        )
        assert listing.verification_tier == 'basic'

    def test_listing_default_view_count_is_zero(self, owner_user):
        listing = Listing.objects.create(
            owner=owner_user,
            resource_type='equipment',
            title='Zero Views',
            status='draft',
        )
        assert listing.view_count == 0


@pytest.mark.django_db
class TestListingMediaModel:
    def test_setting_primary_unsets_others(self, owner_user):
        from tests.factories import ListingFactory, ListingMediaFactory
        listing = ListingFactory(owner=owner_user)

        from django.core.files.uploadedfile import SimpleUploadedFile
        file1 = SimpleUploadedFile('photo1.jpg', b'content', content_type='image/jpeg')
        file2 = SimpleUploadedFile('photo2.jpg', b'content', content_type='image/jpeg')

        media1 = ListingMedia.objects.create(
            listing=listing, file=file1, is_primary=True
        )
        media2 = ListingMedia.objects.create(
            listing=listing, file=file2, is_primary=True
        )

        media1.refresh_from_db()
        assert media1.is_primary is False
        assert media2.is_primary is True
