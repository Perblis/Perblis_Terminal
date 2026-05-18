from django.conf import settings
from django.db import models

from core.models import BaseModel


class BookingStatus(models.TextChoices):
    PENDING = 'pending', 'Pending'
    CONFIRMED = 'confirmed', 'Confirmed'
    DECLINED = 'declined', 'Declined'
    ACTIVE = 'active', 'Active'
    COMPLETED = 'completed', 'Completed'
    CANCELLED = 'cancelled', 'Cancelled'
    CANCELLED_RENTER = 'cancelled_renter', 'Cancelled by Renter'
    CANCELLED_OWNER = 'cancelled_owner', 'Cancelled by Owner'
    CANCELLED_ADMIN = 'cancelled_admin', 'Cancelled by Admin'


class DurationType(models.TextChoices):
    DAILY = 'daily', 'Daily'
    WEEKLY = 'weekly', 'Weekly'
    MONTHLY = 'monthly', 'Monthly'


class PaymentStatus(models.TextChoices):
    UNPAID = 'unpaid', 'Unpaid'
    SIMULATED_PAID = 'simulated_paid', 'Paid (Simulated)'


class Booking(BaseModel):
    renter = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='renter_bookings',
    )
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='owner_bookings',
    )
    listing = models.ForeignKey(
        'listings.Listing',
        on_delete=models.CASCADE,
        related_name='bookings',
    )

    # Dates
    start_date = models.DateField()
    end_date = models.DateField()
    duration_type = models.CharField(
        max_length=10,
        choices=DurationType.choices,
        default=DurationType.DAILY,
    )

    # Financials — tracked for future use, not enforced in MVP
    gross_amount = models.DecimalField(max_digits=15, decimal_places=2)
    commission_rate = models.DecimalField(
        max_digits=5, decimal_places=4, default=0.1000
    )
    commission_rate_label = models.CharField(
        max_length=30, default='10%',
        help_text='Human-readable rate applied, e.g. "12%", "₦2,500 flat"',
    )
    commission_amount = models.DecimalField(max_digits=15, decimal_places=2)
    owner_payout_amount = models.DecimalField(max_digits=15, decimal_places=2)

    # Communication
    renter_note = models.TextField(blank=True, default='')

    # Status
    status = models.CharField(
        max_length=20,
        choices=BookingStatus.choices,
        default=BookingStatus.PENDING,
    )
    payment_status = models.CharField(
        max_length=20,
        choices=PaymentStatus.choices,
        default=PaymentStatus.UNPAID,
    )

    # Cancellation
    cancelled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='cancellations',
    )
    cancellation_reason = models.TextField(blank=True, default='')

    class Meta:
        db_table = 'bookings'
        ordering = ['-created_at']

    def __str__(self):
        return f"Booking: {self.listing.title} | {self.renter.email} | {self.status}"

    @property
    def duration_days(self):
        if self.start_date and self.end_date:
            return (self.end_date - self.start_date).days
        return 0
