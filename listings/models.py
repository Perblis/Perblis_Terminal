from django.conf import settings
from django.contrib.gis.db import models as gis_models
from django.db import models

from core.models import BaseModel


class ResourceType(models.TextChoices):
    EQUIPMENT = 'equipment', 'Heavy Equipment'
    VEHICLE = 'vehicle', 'Vehicle & Transport'
    WAREHOUSE = 'warehouse', 'Warehouse'
    TERMINAL = 'terminal', 'Terminal & Container Yard'
    FACILITY = 'facility', 'Facility & Staging Area'


class ListingStatus(models.TextChoices):
    DRAFT = 'draft', 'Draft'
    ACTIVE = 'active', 'Active'
    PAUSED = 'paused', 'Paused'
    ARCHIVED = 'archived', 'Archived'
    REMOVED_BY_ADMIN = 'removed_by_admin', 'Removed by Admin'


class VerificationTier(models.TextChoices):
    BASIC = 'basic', 'Basic'
    VERIFIED = 'verified', 'Verified'
    INSPECTED = 'inspected', 'Inspected'


class Listing(BaseModel):
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='listings',
    )
    resource_type = models.CharField(
        max_length=20,
        choices=ResourceType.choices,
    )
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True, default='')
    category = models.CharField(max_length=100, blank=True, default='')

    price_daily = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    price_weekly = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    price_monthly = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)

    specs = models.JSONField(default=dict, blank=True)

    location = gis_models.PointField(geography=True, null=True, blank=True)
    location_address = models.TextField(blank=True, default='')
    location_city = models.CharField(max_length=100, blank=True, default='')

    operator_available = models.BooleanField(default=False)
    delivery_available = models.BooleanField(default=False)

    status = models.CharField(
        max_length=20,
        choices=ListingStatus.choices,
        default=ListingStatus.DRAFT,
    )
    is_available = models.BooleanField(default=True)
    verification_tier = models.CharField(
        max_length=20,
        choices=VerificationTier.choices,
        default=VerificationTier.BASIC,
    )

    view_count = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = 'listings'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.title} ({self.resource_type}) — {self.owner.email}"

    @property
    def primary_photo_url(self):
        primary = self.media.filter(is_primary=True).first()
        if primary:
            return primary.file.url
        first = self.media.first()
        return first.file.url if first else None

    @property
    def latitude(self):
        return self.location.y if self.location else None

    @property
    def longitude(self):
        return self.location.x if self.location else None


class ListingMedia(BaseModel):
    listing = models.ForeignKey(
        Listing,
        on_delete=models.CASCADE,
        related_name='media',
    )
    file = models.ImageField(upload_to='listings/')
    is_primary = models.BooleanField(default=False)
    display_order = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = 'listing_media'
        ordering = ['display_order', 'created_at']

    def __str__(self):
        return f"Media for {self.listing.title}"

    def save(self, *args, **kwargs):
        if self.is_primary:
            ListingMedia.objects.filter(
                listing=self.listing,
                is_primary=True,
            ).exclude(id=self.id).update(is_primary=False)
        super().save(*args, **kwargs)


class ListingReport(BaseModel):
    listing = models.ForeignKey(
        Listing,
        on_delete=models.CASCADE,
        related_name='reports',
    )
    reporter = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='submitted_reports',
    )

    REASON_FAKE = 'fake'
    REASON_STOLEN = 'stolen'
    REASON_MISLEADING = 'misleading'
    REASON_SPAM = 'spam'
    REASON_OTHER = 'other'
    REASON_CHOICES = [
        (REASON_FAKE, 'Fake listing'),
        (REASON_STOLEN, 'Stolen equipment'),
        (REASON_MISLEADING, 'Misleading information'),
        (REASON_SPAM, 'Spam'),
        (REASON_OTHER, 'Other'),
    ]
    reason = models.CharField(max_length=20, choices=REASON_CHOICES)
    description = models.TextField(blank=True, default='')

    STATUS_PENDING = 'pending'
    STATUS_REVIEWED = 'reviewed'
    STATUS_DISMISSED = 'dismissed'
    STATUS_CHOICES = [
        (STATUS_PENDING, 'Pending'),
        (STATUS_REVIEWED, 'Reviewed'),
        (STATUS_DISMISSED, 'Dismissed'),
    ]
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)

    class Meta:
        db_table = 'listing_reports'
        ordering = ['-created_at']
        unique_together = [['listing', 'reporter']]

    def __str__(self):
        return f"Report: {self.listing.title} by {self.reporter.email}"
