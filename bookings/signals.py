from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import Booking, BookingStatus


@receiver(post_save, sender=Booking)
def handle_booking_status_change(sender, instance, created, **kwargs):
    """
    When a booking is confirmed, mark the listing as unavailable
    for the booked period (simple approach: mark is_available=False
    if there is at least one active/confirmed booking).

    When a booking is cancelled/declined, check if listing should
    be marked available again.
    """
    from listings.models import Listing

    listing = instance.listing

    if instance.status in [BookingStatus.CONFIRMED, BookingStatus.ACTIVE]:
        has_active = Booking.objects.filter(
            listing=listing,
            status__in=[BookingStatus.CONFIRMED, BookingStatus.ACTIVE],
        ).exists()
        if has_active:
            Listing.objects.filter(id=listing.id).update(is_available=False)

    elif instance.status in [BookingStatus.CANCELLED, BookingStatus.DECLINED, BookingStatus.COMPLETED]:
        has_active = Booking.objects.filter(
            listing=listing,
            status__in=[BookingStatus.CONFIRMED, BookingStatus.ACTIVE],
        ).exists()
        if not has_active:
            Listing.objects.filter(id=listing.id).update(is_available=True)
