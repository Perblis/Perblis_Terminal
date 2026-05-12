import pytest
from messaging.models import Thread, Message


@pytest.mark.django_db
class TestThreadModel:
    def test_thread_str_with_booking(self, owner_user, renter_user):
        from tests.factories import ListingFactory, BookingFactory
        listing = ListingFactory(owner=owner_user)
        booking = BookingFactory(renter=renter_user, owner=owner_user, listing=listing)
        thread = Thread.objects.create(listing=listing, booking=booking)
        thread.participants.add(owner_user, renter_user)
        assert 'Booking' in str(thread)

    def test_thread_str_with_listing(self, owner_user):
        from tests.factories import ListingFactory
        listing = ListingFactory(owner=owner_user)
        thread = Thread.objects.create(listing=listing)
        assert 'Inquiry' in str(thread)

    def test_is_booking_thread_property(self, owner_user, renter_user):
        from tests.factories import ListingFactory, BookingFactory
        listing = ListingFactory(owner=owner_user)
        booking = BookingFactory(renter=renter_user, owner=owner_user, listing=listing)
        booking_thread = Thread.objects.create(listing=listing, booking=booking)
        inquiry_thread = Thread.objects.create(listing=listing)
        assert booking_thread.is_booking_thread is True
        assert inquiry_thread.is_booking_thread is False

    def test_get_other_participant(self, owner_user, renter_user):
        from tests.factories import ListingFactory
        listing = ListingFactory(owner=owner_user)
        thread = Thread.objects.create(listing=listing)
        thread.participants.add(owner_user, renter_user)
        other = thread.get_other_participant(owner_user)
        assert other == renter_user


@pytest.mark.django_db
class TestMessagingServices:
    def test_get_or_create_booking_thread(self, owner_user, renter_user):
        from tests.factories import ListingFactory, BookingFactory
        from messaging.services import get_or_create_booking_thread
        listing = ListingFactory(owner=owner_user)
        booking = BookingFactory(renter=renter_user, owner=owner_user, listing=listing)
        result = get_or_create_booking_thread(booking)
        thread = result[0] if isinstance(result, tuple) else result
        assert thread is not None
        assert owner_user in thread.participants.all()
        assert renter_user in thread.participants.all()

    def test_get_or_create_booking_thread_idempotent(self, owner_user, renter_user):
        from tests.factories import ListingFactory, BookingFactory
        from messaging.services import get_or_create_booking_thread
        listing = ListingFactory(owner=owner_user)
        booking = BookingFactory(renter=renter_user, owner=owner_user, listing=listing)
        t1 = get_or_create_booking_thread(booking)
        t2 = get_or_create_booking_thread(booking)
        if isinstance(t1, tuple):
            t1 = t1[0]
        if isinstance(t2, tuple):
            t2 = t2[0]
        assert t1.id == t2.id

    def test_publish_to_ably_without_key_prints_to_console(self, capsys):
        from messaging.services import publish_to_ably
        import uuid
        publish_to_ably(str(uuid.uuid4()), {'body': 'Test message'})
        captured = capsys.readouterr()
        assert '[DEV ABLY]' in captured.out

    def test_inquiry_thread_created_for_different_renters(
        self, owner_user, renter_user, create_user
    ):
        from tests.factories import ListingFactory
        from messaging.services import get_or_create_inquiry_thread
        listing = ListingFactory(owner=owner_user)
        renter2 = create_user(email='renter2@msg.com', phone='08066662222')
        t1, c1 = get_or_create_inquiry_thread(listing, renter_user)
        t2, c2 = get_or_create_inquiry_thread(listing, renter2)
        assert t1.id != t2.id
        assert c1 is True
        assert c2 is True

    def test_inquiry_thread_reused_for_same_renter(self, owner_user, renter_user):
        from tests.factories import ListingFactory
        from messaging.services import get_or_create_inquiry_thread
        listing = ListingFactory(owner=owner_user)
        t1, c1 = get_or_create_inquiry_thread(listing, renter_user)
        t2, c2 = get_or_create_inquiry_thread(listing, renter_user)
        assert t1.id == t2.id
        assert c2 is False
