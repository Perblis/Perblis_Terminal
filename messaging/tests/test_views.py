import pytest
from messaging.models import Thread, Message


@pytest.mark.django_db
class TestThreadListCreate:
    URL = '/api/v1/threads/'

    def test_unauthenticated_cannot_list(self, api_client):
        response = api_client.get(self.URL)
        assert response.status_code == 401

    def test_user_sees_only_own_threads(self, auth_client, renter_user, owner_user):
        from tests.factories import ListingFactory
        listing = ListingFactory(owner=owner_user)
        thread = Thread.objects.create(listing=listing)
        thread.participants.add(renter_user, owner_user)

        unrelated_listing = ListingFactory()
        unrelated_thread = Thread.objects.create(listing=unrelated_listing)

        response = auth_client.get(self.URL)
        ids = [t['id'] for t in response.data['results']]
        assert str(thread.id) in ids
        assert str(unrelated_thread.id) not in ids

    def test_response_is_paginated(self, auth_client):
        response = auth_client.get(self.URL)
        assert 'count' in response.data
        assert 'results' in response.data

    def test_filter_by_thread_type_booking(self, auth_client, renter_user, owner_user):
        from tests.factories import ListingFactory, BookingFactory
        listing = ListingFactory(owner=owner_user)
        booking = BookingFactory(renter=renter_user, owner=owner_user, listing=listing)

        booking_thread = Thread.objects.create(listing=listing, booking=booking)
        booking_thread.participants.add(renter_user, owner_user)

        inquiry_thread = Thread.objects.create(listing=listing)
        inquiry_thread.participants.add(renter_user, owner_user)

        response = auth_client.get(f'{self.URL}?thread_type=booking')
        ids = [t['id'] for t in response.data['results']]
        assert str(booking_thread.id) in ids
        assert str(inquiry_thread.id) not in ids

    def test_filter_unread_returns_only_unread_threads(
        self, auth_client, renter_user, owner_user
    ):
        from tests.factories import ListingFactory
        listing = ListingFactory(owner=owner_user)

        thread_with_unread = Thread.objects.create(listing=listing)
        thread_with_unread.participants.add(renter_user, owner_user)
        Message.objects.create(
            thread=thread_with_unread, sender=owner_user, body='Unread msg', is_read=False
        )

        thread_all_read = Thread.objects.create(listing=listing)
        thread_all_read.participants.add(renter_user, owner_user)
        Message.objects.create(
            thread=thread_all_read, sender=owner_user, body='Read msg', is_read=True
        )

        response = auth_client.get(f'{self.URL}?unread=true')
        ids = [t['id'] for t in response.data['results']]
        assert str(thread_with_unread.id) in ids
        assert str(thread_all_read.id) not in ids

    def test_create_inquiry_thread(self, auth_client, owner_user):
        from tests.factories import ListingFactory
        listing = ListingFactory(owner=owner_user, status='active')
        response = auth_client.post(self.URL, {
            'listing_id': str(listing.id),
            'initial_message': 'Is this available next week?',
        }, format='json')
        assert response.status_code == 201

    def test_cannot_send_inquiry_to_own_listing(self, owner_client, owner_user):
        from tests.factories import ListingFactory
        listing = ListingFactory(owner=owner_user, status='active')
        response = owner_client.post(self.URL, {
            'listing_id': str(listing.id),
            'initial_message': 'Testing',
        }, format='json')
        assert response.status_code == 400


@pytest.mark.django_db
class TestThreadDetail:
    def test_participant_can_view_thread(self, auth_client, renter_user, owner_user):
        from tests.factories import ListingFactory
        listing = ListingFactory(owner=owner_user)
        thread = Thread.objects.create(listing=listing)
        thread.participants.add(renter_user, owner_user)
        response = auth_client.get(f'/api/v1/threads/{thread.id}/')
        assert response.status_code == 200
        assert 'messages' in response.data

    def test_non_participant_cannot_view_thread(self, auth_client, create_user, owner_user):
        from tests.factories import ListingFactory
        listing = ListingFactory(owner=owner_user)
        thread = Thread.objects.create(listing=listing)
        stranger = create_user(email='stranger2@msg.com', phone='08066663333')
        thread.participants.add(owner_user, stranger)
        response = auth_client.get(f'/api/v1/threads/{thread.id}/')
        assert response.status_code == 404

    def test_viewing_thread_marks_messages_read(
        self, auth_client, renter_user, owner_user
    ):
        from tests.factories import ListingFactory
        listing = ListingFactory(owner=owner_user)
        thread = Thread.objects.create(listing=listing)
        thread.participants.add(renter_user, owner_user)
        Message.objects.create(
            thread=thread, sender=owner_user, body='Hello', is_read=False
        )
        auth_client.get(f'/api/v1/threads/{thread.id}/')
        assert Message.objects.filter(thread=thread, is_read=False, sender=owner_user).count() == 0


@pytest.mark.django_db
class TestSendMessage:
    def test_participant_can_send_message(self, auth_client, renter_user, owner_user):
        from tests.factories import ListingFactory
        listing = ListingFactory(owner=owner_user)
        thread = Thread.objects.create(listing=listing)
        thread.participants.add(renter_user, owner_user)
        response = auth_client.post(
            f'/api/v1/threads/{thread.id}/messages/',
            {'body': 'Hello, is this available?'},
        )
        assert response.status_code == 201
        assert response.data['data']['body'] == 'Hello, is this available?'

    def test_non_participant_cannot_send(self, auth_client, create_user, owner_user):
        from tests.factories import ListingFactory
        listing = ListingFactory(owner=owner_user)
        thread = Thread.objects.create(listing=listing)
        stranger = create_user(email='stranger3@msg.com', phone='08066664444')
        thread.participants.add(owner_user, stranger)
        response = auth_client.post(
            f'/api/v1/threads/{thread.id}/messages/',
            {'body': 'Hacking message'},
        )
        assert response.status_code == 404

    def test_empty_message_rejected(self, auth_client, renter_user, owner_user):
        from tests.factories import ListingFactory
        listing = ListingFactory(owner=owner_user)
        thread = Thread.objects.create(listing=listing)
        thread.participants.add(renter_user, owner_user)
        response = auth_client.post(
            f'/api/v1/threads/{thread.id}/messages/',
            {'body': ''},
        )
        assert response.status_code == 400


@pytest.mark.django_db
class TestMarkThreadRead:
    def test_marks_all_messages_read(self, auth_client, renter_user, owner_user):
        from tests.factories import ListingFactory
        listing = ListingFactory(owner=owner_user)
        thread = Thread.objects.create(listing=listing)
        thread.participants.add(renter_user, owner_user)
        Message.objects.create(thread=thread, sender=owner_user, body='msg1', is_read=False)
        Message.objects.create(thread=thread, sender=owner_user, body='msg2', is_read=False)
        response = auth_client.patch(f'/api/v1/threads/{thread.id}/read/')
        assert response.status_code == 200
        assert response.data['messages_marked_read'] == 2

    def test_does_not_mark_own_messages_read(self, auth_client, renter_user, owner_user):
        from tests.factories import ListingFactory
        listing = ListingFactory(owner=owner_user)
        thread = Thread.objects.create(listing=listing)
        thread.participants.add(renter_user, owner_user)
        Message.objects.create(thread=thread, sender=renter_user, body='own msg', is_read=False)
        response = auth_client.patch(f'/api/v1/threads/{thread.id}/read/')
        assert response.data['messages_marked_read'] == 0
