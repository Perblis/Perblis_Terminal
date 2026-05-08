from django.conf import settings


def get_or_create_booking_thread(booking):
    """
    Get or create a thread for a booking.
    Called automatically when a booking is created.
    """
    from .models import Thread

    thread, created = Thread.objects.get_or_create(booking=booking)
    if created:
        thread.listing = booking.listing
        thread.save()
        thread.participants.add(booking.renter, booking.owner)
    return thread


def get_or_create_inquiry_thread(listing, renter):
    """
    Get or create an inquiry thread between a renter and a listing owner.
    Used when a renter sends a message from the listing page before booking.
    """
    from .models import Thread

    existing = Thread.objects.filter(
        listing=listing,
        booking__isnull=True,
        participants=renter,
    ).first()

    if existing:
        return existing, False

    thread = Thread.objects.create(listing=listing)
    thread.participants.add(renter, listing.owner)
    return thread, True


def publish_to_ably(thread_id, message_data):
    """
    Publish a new message to the Ably channel for the thread.
    Falls back gracefully if Ably is not configured.
    """
    if not settings.ABLY_API_KEY:
        print(f"[DEV ABLY] Ably not configured. Message in thread {thread_id}: {message_data}")
        return

    try:
        from ably import AblyRest
        client = AblyRest(settings.ABLY_API_KEY)
        channel = client.channels.get(f"thread:{thread_id}")
        channel.publish('new_message', message_data)
    except Exception as e:
        print(f"[ABLY ERROR] Failed to publish to thread {thread_id}: {e}")


def get_ably_token(user):
    """
    Generate an Ably token for the authenticated user.
    The token is scoped to channels this user is a participant in.
    """
    if not settings.ABLY_API_KEY:
        return None

    try:
        from ably import AblyRest

        client = AblyRest(settings.ABLY_API_KEY)

        from .models import Thread
        thread_ids = Thread.objects.filter(
            participants=user
        ).values_list('id', flat=True)

        capability = {}
        for thread_id in thread_ids:
            capability[f"thread:{thread_id}"] = ['subscribe', 'publish']

        if not capability:
            capability = {'*': []}

        token_request = client.auth.request_token(
            token_params={
                'client_id': str(user.id),
                'capability': capability,
            }
        )
        return token_request

    except Exception as e:
        print(f"[ABLY ERROR] Token generation failed for {user.email}: {e}")
        return None
