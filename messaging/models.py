from django.conf import settings
from django.db import models

from core.models import BaseModel


class Thread(BaseModel):
    """
    A conversation thread. Tied to either a listing (inquiry) or a booking.
    A booking thread is created automatically when a booking request is made.
    An inquiry thread is created when a renter messages an owner from a listing page.
    """
    listing = models.ForeignKey(
        'listings.Listing',
        on_delete=models.CASCADE,
        related_name='threads',
        null=True, blank=True,
    )
    booking = models.OneToOneField(
        'bookings.Booking',
        on_delete=models.CASCADE,
        related_name='thread',
        null=True, blank=True,
    )
    participants = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name='threads',
    )

    class Meta:
        db_table = 'threads'
        ordering = ['-updated_at']

    def __str__(self):
        if self.booking:
            return f"Booking thread: {self.booking}"
        return f"Inquiry thread: {self.listing}"

    @property
    def is_booking_thread(self):
        return self.booking_id is not None

    def get_other_participant(self, user):
        return self.participants.exclude(id=user.id).first()


class Message(BaseModel):
    thread = models.ForeignKey(
        Thread,
        on_delete=models.CASCADE,
        related_name='messages',
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='sent_messages',
    )
    body = models.TextField()
    is_read = models.BooleanField(default=False)

    class Meta:
        db_table = 'messages'
        ordering = ['created_at']

    def __str__(self):
        return f"Message from {self.sender.email} in thread {self.thread.id}"
