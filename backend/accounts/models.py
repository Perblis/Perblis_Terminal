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
from django.db.models import Q
from django.utils import timezone

from accounts.enums import OtpPurpose, VerificationKind, VerificationState
from accounts.managers import UserManager
from core.models import BaseModel


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
    full_name = models.CharField(max_length=150)
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

    # A Basic account is "OTP + email" (FSD §4.1): phone and email are each
    # verified over their own channel (SMS code / email code), and login
    # requires both. Set when the respective OTP is verified.
    phone_verified_at = models.DateTimeField(null=True, blank=True)
    email_verified_at = models.DateTimeField(null=True, blank=True)

    # NDPR consent captured at registration (FSD §12).
    tos_accepted_at = models.DateTimeField(null=True, blank=True)
    privacy_accepted_at = models.DateTimeField(null=True, blank=True)

    # Bumped on logout-all / password-reset-confirm; carried in the JWT `tv`
    # claim so a bump invalidates every outstanding access token immediately
    # (blacklisting only kills refresh tokens — see accounts/authentication.py).
    token_version = models.PositiveIntegerField(default=0)

    # Suspension (Ops action) and soft-delete.
    suspended_at = models.DateTimeField(null=True, blank=True)
    suspended_reason = models.TextField(blank=True)
    deleted_at = models.DateTimeField(null=True, blank=True)
    # Set when the daily purge has scrubbed PII after the 30-day recovery
    # window. Verification records are retained (NDPR) — only the account's
    # identifying data is erased. Doubles as the idempotency marker.
    purged_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["phone", "full_name"]

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
    def is_phone_verified(self) -> bool:
        return self.phone_verified_at is not None

    @property
    def is_email_verified(self) -> bool:
        return self.email_verified_at is not None

    @property
    def is_verified(self) -> bool:
        return self.account_level in {
            AccountLevel.VERIFIED,
            AccountLevel.BUSINESS_VERIFIED,
        }

    @property
    def is_suspended(self) -> bool:
        return self.suspended_at is not None

    @property
    def is_deleted(self) -> bool:
        return self.deleted_at is not None

    def soft_delete(self) -> None:
        self.deleted_at = timezone.now()
        self.is_active = False
        self.save(update_fields=["deleted_at", "is_active", "updated_at"])


class OtpCode(BaseModel):
    """A one-time code for phone verification.

    The plaintext code is never stored — only an HMAC digest (see
    `accounts.services.otp`). Defence is expiry + the attempt cap + the
    per-phone send throttle, not hash cost.
    """

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="otp_codes")
    code_hash = models.CharField(max_length=128)
    purpose = models.CharField(
        max_length=32,
        choices=OtpPurpose.choices,
        default=OtpPurpose.PHONE_VERIFY,
    )
    expires_at = models.DateTimeField()
    attempts = models.PositiveSmallIntegerField(default=0)
    consumed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "otp_codes"
        indexes = [models.Index(fields=["user", "purpose", "-created_at"])]

    @property
    def is_expired(self) -> bool:
        return timezone.now() >= self.expires_at

    @property
    def is_consumed(self) -> bool:
        return self.consumed_at is not None


class VerificationRequest(BaseModel):
    """An identity or business document submission awaiting Ops review."""

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="verification_requests")
    kind = models.CharField(max_length=16, choices=VerificationKind.choices)
    # Object keys in the PRIVATE bucket; never public URLs.
    doc_keys = models.JSONField(default=list)
    state = models.CharField(
        max_length=16,
        choices=VerificationState.choices,
        default=VerificationState.PENDING,
    )
    reviewer = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_verifications",
    )
    reason = models.TextField(blank=True)
    rc_number = models.CharField(max_length=32, blank=True)  # business only
    decided_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "verification_requests"
        constraints = [
            # One open request per kind; resubmission is allowed only after the
            # previous one is approved or rejected.
            models.UniqueConstraint(
                fields=["user", "kind"],
                condition=Q(state="pending"),
                name="uniq_pending_verification_per_kind",
            )
        ]


class PasswordResetToken(BaseModel):
    """Single-use, 1-hour password-reset token.

    Only the HMAC digest of the opaque token is stored; the plaintext travels
    in the emailed link and is never persisted.
    """

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="password_reset_tokens")
    token_hash = models.CharField(max_length=128, db_index=True)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "password_reset_tokens"

    @property
    def is_usable(self) -> bool:
        return self.used_at is None and timezone.now() < self.expires_at
