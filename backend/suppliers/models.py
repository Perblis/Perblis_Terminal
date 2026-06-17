"""Suppliers: business profiles and yards (TSD §3.3, FSD §5.1).

A ``SupplierProfile`` holds the public-facing business identity plus the
payout bank details. The bank account number is encrypted at rest
(``EncryptedTextField``) — a raw DB read never yields plaintext, and it is
never serialized unmasked. Profile completeness (business name + full bank
details) is one of the gates a listing must pass to go Live (FSD §5.2).
"""

from __future__ import annotations

from django.conf import settings
from django.contrib.gis.db import models as gis_models
from django.db import models

from core.fields import EncryptedTextField
from core.models import BaseModel


class SupplierProfile(BaseModel):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="supplier_profile",
    )
    business_name = models.CharField(max_length=200, blank=True, default="")
    description = models.TextField(blank=True, default="")
    # Public bucket key for the logo (resolved to a URL via core.media.public_url).
    logo_key = models.CharField(max_length=255, blank=True, default="")

    bank_name = models.CharField(max_length=100, blank=True, default="")
    # Encrypted at rest; the Python attribute holds plaintext, the column holds
    # ciphertext. Never filter/index on this column.
    bank_account_number_enc = EncryptedTextField(blank=True, default="")
    bank_account_name = models.CharField(max_length=200, blank=True, default="")

    # Per-type notification preferences (default ON).
    notif_hire_requests = models.BooleanField(default=True)
    notif_messages = models.BooleanField(default=True)
    notif_payouts = models.BooleanField(default=True)
    notif_marketing = models.BooleanField(default=True)

    # Ops-managed strike counter (read-only to the supplier).
    strike_count = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "supplier_profiles"

    def __str__(self) -> str:
        return self.business_name or f"SupplierProfile<{self.user_id}>"

    @property
    def masked_bank_account_number(self) -> str:
        number = self.bank_account_number_enc or ""
        return f"****{number[-4:]}" if number else ""

    @property
    def is_complete(self) -> bool:
        """All payout-critical fields present (the publish gate; FSD §5.2).

        Logo and description are optional; everything else must be filled.
        """
        return bool(
            self.business_name
            and self.bank_name
            and self.bank_account_number_enc
            and self.bank_account_name
        )


class Yard(BaseModel):
    """A supplier's named geographic location (FSD §5.1).

    Listings attach to 0..1 yard and inherit its coordinates. A yard with
    listings cannot be deleted — the listing→yard FK is ``PROTECT`` (added in
    the listings slice), so the DB itself blocks the delete and the service
    surfaces it as ``yard_has_listings``.
    """

    supplier = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="yards",
    )
    name = models.CharField(max_length=200)
    point = gis_models.PointField(geography=True, srid=4326)
    address_text = models.CharField(max_length=300, blank=True, default="")
    city = models.CharField(max_length=120, blank=True, default="")

    class Meta:
        db_table = "yards"
        indexes = [models.Index(fields=["supplier"])]

    def __str__(self) -> str:
        return self.name
