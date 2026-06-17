"""Supplier profile service — all profile mutation lives here (not in views).

Views validate input and shape output; this module owns the writes.
"""

from __future__ import annotations

from django.db import transaction

from accounts.models import User
from suppliers.models import SupplierProfile

# Serializer field name -> model field name for the encrypted bank number.
_BANK_NUMBER_IN = "bank_account_number"

# Fields a supplier may set via PATCH.
_WRITABLE = {
    "business_name",
    "description",
    "logo_key",
    "bank_name",
    "bank_account_name",
    "notif_hire_requests",
    "notif_messages",
    "notif_payouts",
    "notif_marketing",
}


def get_or_create_profile(user: User) -> SupplierProfile:
    profile, _ = SupplierProfile.objects.get_or_create(user=user)
    return profile


@transaction.atomic
def update_profile(*, user: User, **fields) -> SupplierProfile:
    profile = SupplierProfile.objects.select_for_update().get_or_create(user=user)[0]
    for name, value in fields.items():
        if name == _BANK_NUMBER_IN:
            profile.bank_account_number_enc = value
        elif name in _WRITABLE:
            setattr(profile, name, value)
    profile.save()
    return profile


def profile_complete(user: User) -> bool:
    """Whether the user's supplier profile is complete enough to publish."""
    profile = SupplierProfile.objects.filter(user=user).first()
    return bool(profile and profile.is_complete)
