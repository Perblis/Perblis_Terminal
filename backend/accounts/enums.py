"""Enumerations for the accounts app.

Kept separate from models so services, serializers, and migrations can import
the choices without pulling in the model layer.
"""

from __future__ import annotations

from django.db import models


class OtpPurpose(models.TextChoices):
    # Phone and email are verified independently, each over its own channel.
    PHONE_VERIFY = "phone_verify", "Phone verification"
    EMAIL_VERIFY = "email_verify", "Email verification"


class VerificationKind(models.TextChoices):
    IDENTITY = "identity", "Identity"
    BUSINESS = "business", "Business"


class VerificationState(models.TextChoices):
    PENDING = "pending", "Pending"
    APPROVED = "approved", "Approved"
    REJECTED = "rejected", "Rejected"
