"""Accounts: the custom User.

This model must exist from Wave 0 — Django's auth user cannot be swapped after
other tables reference it, so it lands as migration 0001 before anything else
touches the DB. Auth *flows* (register, OTP, JWT, reset) are Wave 1; only the
model and its manager live here now.

Schema per TSD §3.3: email (citext, unique), phone (unique, E.164), bcrypt
password, is_supplier/is_hirer flags, account_level enum, soft-delete +
suspension fields.
"""

from __future__ import annotations

from django.contrib.auth.base_user import AbstractBaseUser
from django.contrib.auth.models import PermissionsMixin
from django.core.validators import RegexValidator
from django.db import models
from django.utils import timezone

from accounts.managers import UserManager


class CIEmailField(models.EmailField):
    """EmailField backed by Postgres `citext` for case-insensitive uniqueness."""

    def db_type(self, connection) -> str:
        return "citext"


E164_VALIDATOR = RegexValidator(
    regex=r"^\+[1-9]\d{1,14}$",
    message="Phone must be in E.164 format, e.g. +2348012345678.",
)


class AccountLevel(models.TextChoices):
    BASIC = "basic", "Basic"
    VERIFIED = "verified", "Verified"
    BUSINESS_VERIFIED = "business_verified", "Business verified"


class User(AbstractBaseUser, PermissionsMixin):
    id = models.UUIDField(primary_key=True, editable=False)
    email = CIEmailField(unique=True)
    phone = models.CharField(max_length=16, unique=True, validators=[E164_VALIDATOR])

    is_supplier = models.BooleanField(default=False)
    is_hirer = models.BooleanField(default=False)

    account_level = models.CharField(
        max_length=20,
        choices=AccountLevel.choices,
        default=AccountLevel.BASIC,
    )

    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)

    # Suspension (Ops action) and soft-delete.
    suspended_at = models.DateTimeField(null=True, blank=True)
    suspended_reason = models.TextField(blank=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["phone"]

    class Meta:
        db_table = "users"

    def __str__(self) -> str:
        return self.email

    def save(self, *args, **kwargs):
        if not self.id:
            # Match BaseModel's UUIDv7 PK without inheriting it (User has its
            # own base classes).
            from core.ids import uuid7

            self.id = uuid7()
        super().save(*args, **kwargs)

    @property
    def is_verified(self) -> bool:
        return self.account_level in {
            AccountLevel.VERIFIED,
            AccountLevel.BUSINESS_VERIFIED,
        }

    @property
    def is_suspended(self) -> bool:
        return self.suspended_at is not None

    def soft_delete(self) -> None:
        self.deleted_at = timezone.now()
        self.is_active = False
        self.save(update_fields=["deleted_at", "is_active", "updated_at"])
