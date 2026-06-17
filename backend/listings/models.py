"""Listings models — spec templates first (Wave 2 §2.3, TSD §3.3).

A ``SpecTemplate`` is server-side configuration (versioned) describing the
``specs`` a listing of a given ``asset_class`` + ``asset_type`` carries. Field
definitions follow doc 05 (the normative source); the launch set is seeded by
``seed_spec_templates``.
"""

from __future__ import annotations

from django.conf import settings
from django.contrib.gis.db import models as gis_models
from django.contrib.postgres.indexes import GinIndex
from django.db import models

from core.models import BaseModel
from listings.enums import AssetClass, ListingStatus, ListingTier


class SpecTemplate(BaseModel):
    asset_class = models.CharField(max_length=32, choices=AssetClass.choices)
    asset_type = models.CharField(max_length=100)
    version = models.PositiveIntegerField(default=1)
    # field_name -> {kind, unit?, required, options?, filterable, display_name}
    fields = models.JSONField(default=dict)

    class Meta:
        db_table = "spec_templates"
        constraints = [
            models.UniqueConstraint(
                fields=["asset_class", "asset_type", "version"],
                name="uniq_spec_template_class_type_version",
            )
        ]
        indexes = [models.Index(fields=["asset_class", "asset_type"])]

    def __str__(self) -> str:
        return f"{self.asset_class}/{self.asset_type} v{self.version}"


class Listing(BaseModel):
    """A supplier's market offer of an asset (FSD §5.2, TSD §3.3).

    Pricing is integer kobo. ``status`` only ever changes through
    ``listings.state.apply`` (the state machine). The yard FK is ``PROTECT`` so
    a yard with listings can't be deleted (surfaced as ``yard_has_listings``).
    """

    supplier = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="listings"
    )
    yard = models.ForeignKey(
        "suppliers.Yard",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="listings",
    )
    asset_class = models.CharField(max_length=32, choices=AssetClass.choices)
    asset_type = models.CharField(max_length=100)
    title = models.CharField(max_length=120)
    description = models.TextField()
    specs = models.JSONField(default=dict)
    spec_template_version = models.PositiveIntegerField(default=1)

    # Money: integer kobo. Daily required; weekly/monthly optional.
    daily_price = models.BigIntegerField()
    weekly_price = models.BigIntegerField(null=True, blank=True)
    monthly_price = models.BigIntegerField(null=True, blank=True)

    unit_count = models.PositiveIntegerField(default=1)

    # Denormalised from the yard, or the listing's own pin / geocoded address.
    point = gis_models.PointField(geography=True, srid=4326, null=True, blank=True)
    address_text = models.CharField(max_length=300, blank=True, default="")
    city = models.CharField(max_length=120, blank=True, default="")

    status = models.CharField(
        max_length=16, choices=ListingStatus.choices, default=ListingStatus.DRAFT
    )
    tier = models.CharField(max_length=16, choices=ListingTier.choices, default=ListingTier.BASIC)

    report_count = models.PositiveIntegerField(default=0)
    priority_review_flag = models.BooleanField(default=False)
    completeness_score = models.FloatField(default=0.0)  # stored, not user-visible (MVP)
    removed_reason = models.TextField(blank=True, default="")

    class Meta:
        db_table = "listings"
        indexes = [
            models.Index(fields=["status", "asset_class"]),
            models.Index(fields=["supplier", "status"]),
            GinIndex(fields=["specs"], name="listings_specs_gin"),
        ]

    def __str__(self) -> str:
        return self.title


class Unit(BaseModel):
    """An individual machine within a listing (optional per-unit labels)."""

    listing = models.ForeignKey(Listing, on_delete=models.CASCADE, related_name="units")
    label = models.CharField(max_length=120, blank=True, default="")

    class Meta:
        db_table = "units"

    def __str__(self) -> str:
        return self.label or f"Unit<{self.id}>"


class ListingPhoto(BaseModel):
    """A photo attached to a listing (≤10, ordered, one cover). ≤10 enforced
    in the service; bytes live in the public bucket (key only here)."""

    listing = models.ForeignKey(Listing, on_delete=models.CASCADE, related_name="photos")
    r2_key = models.CharField(max_length=255)
    position = models.PositiveIntegerField(default=0)
    is_cover = models.BooleanField(default=False)

    class Meta:
        db_table = "listing_photos"
        ordering = ["position"]

    def __str__(self) -> str:
        return self.r2_key
