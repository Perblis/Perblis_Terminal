import factory
from factory.django import DjangoModelFactory
from django.contrib.auth import get_user_model
from django.contrib.gis.geos import Point
from django.core.files.uploadedfile import SimpleUploadedFile
from faker import Faker
import random

fake = Faker()
User = get_user_model()


class UserFactory(DjangoModelFactory):
    class Meta:
        model = User
        django_get_or_create = ('email',)

    email = factory.LazyAttribute(lambda _: fake.unique.email())
    phone = factory.LazyAttribute(lambda _: f"080{random.randint(10000000, 99999999)}")
    first_name = factory.LazyAttribute(lambda _: fake.first_name())
    last_name = factory.LazyAttribute(lambda _: fake.last_name())
    is_renter = True
    is_owner = False
    is_email_verified = True
    is_phone_verified = True

    @classmethod
    def _create(cls, model_class, *args, **kwargs):
        password = kwargs.pop('password', 'testpass123!')
        obj = super()._create(model_class, *args, **kwargs)
        obj.set_password(password)
        obj.save()
        return obj


class OwnerUserFactory(UserFactory):
    is_renter = False
    is_owner = True


class RenterUserFactory(UserFactory):
    is_renter = True
    is_owner = False


class DualUserFactory(UserFactory):
    is_renter = True
    is_owner = True


class ListingFactory(DjangoModelFactory):
    class Meta:
        model = 'listings.Listing'

    owner = factory.SubFactory(OwnerUserFactory)
    resource_type = 'equipment'
    title = factory.LazyAttribute(lambda _: f"{fake.word().title()} Equipment")
    description = factory.LazyAttribute(lambda _: fake.paragraph())
    category = 'Mobile Crane'
    price_daily = factory.LazyAttribute(lambda _: random.randint(20000, 100000))
    price_weekly = factory.LazyAttribute(lambda _: random.randint(100000, 500000))
    price_monthly = factory.LazyAttribute(lambda _: random.randint(400000, 2000000))
    specs = factory.LazyAttribute(lambda _: {'tonnage': 50, 'fuel_type': 'diesel'})
    location = factory.LazyAttribute(
        lambda _: Point(
            3.3792 + random.uniform(-0.05, 0.05),
            6.5244 + random.uniform(-0.05, 0.05),
            srid=4326,
        )
    )
    location_address = factory.LazyAttribute(lambda _: fake.street_address())
    location_city = 'Lagos'
    status = 'active'
    is_available = True
    verification_tier = 'basic'
    view_count = 0


class WarehouseListingFactory(ListingFactory):
    resource_type = 'warehouse'
    category = 'General Warehouse'
    specs = {'floor_area_sqm': 2000, 'height_clearance_m': 8, 'loading_bays': 2}


class VehicleListingFactory(ListingFactory):
    resource_type = 'vehicle'
    category = 'Flatbed Truck'
    specs = {'payload_tonnes': 20, 'axles': 3}


class DraftListingFactory(ListingFactory):
    status = 'draft'


class ListingNoLocationFactory(ListingFactory):
    location = None
    status = 'draft'


class ListingMediaFactory(DjangoModelFactory):
    class Meta:
        model = 'listings.ListingMedia'

    listing = factory.SubFactory(ListingFactory)
    file = factory.LazyAttribute(
        lambda _: SimpleUploadedFile('photo.jpg', b'imgcontent', content_type='image/jpeg')
    )
    is_primary = False
    display_order = 0


class BookingFactory(DjangoModelFactory):
    class Meta:
        model = 'bookings.Booking'

    renter = factory.SubFactory(RenterUserFactory)
    owner = factory.LazyAttribute(lambda obj: obj.listing.owner)
    listing = factory.SubFactory(ListingFactory)
    start_date = factory.LazyAttribute(
        lambda _: fake.future_date(end_date='+30d')
    )
    end_date = factory.LazyAttribute(
        lambda obj: fake.date_between(
            start_date=obj.start_date,
            end_date='+60d',
        )
    )
    duration_type = 'daily'
    gross_amount = factory.LazyAttribute(lambda _: random.randint(50000, 500000))
    commission_rate = 0.10
    commission_amount = factory.LazyAttribute(
        lambda obj: round(float(obj.gross_amount) * 0.10, 2)
    )
    owner_payout_amount = factory.LazyAttribute(
        lambda obj: round(float(obj.gross_amount) * 0.90, 2)
    )
    status = 'pending'
    payment_status = 'unpaid'


class ConfirmedBookingFactory(BookingFactory):
    status = 'confirmed'


class ThreadFactory(DjangoModelFactory):
    class Meta:
        model = 'messaging.Thread'

    listing = factory.SubFactory(ListingFactory)


class MessageFactory(DjangoModelFactory):
    class Meta:
        model = 'messaging.Message'

    thread = factory.SubFactory(ThreadFactory)
    sender = factory.SubFactory(UserFactory)
    body = factory.LazyAttribute(lambda _: fake.sentence())
    is_read = False


class OwnerProfileFactory(DjangoModelFactory):
    class Meta:
        model = 'accounts.OwnerProfile'
        django_get_or_create = ('user',)

    user = factory.SubFactory(OwnerUserFactory)
    business_name = factory.LazyAttribute(lambda _: f"{fake.company()} Ltd")
    bank_name = 'First Bank'
    bank_account_number = '3012345678'
    bank_account_name = factory.LazyAttribute(lambda _: fake.name().upper())


def make_publishable_listing(owner, **kwargs):
    """Creates a listing that satisfies all publish requirements: has a location and at least one photo."""
    listing = ListingFactory(
        owner=owner,
        status='draft',
        location=Point(3.3792, 6.5244, srid=4326),
        **kwargs,
    )
    ListingMediaFactory(listing=listing, is_primary=True)
    return listing
