"""Payments enums (TSD §3.3)."""

from __future__ import annotations

from django.db import models


class PaymentState(models.TextChoices):
    INITIATED = "initiated", "Initiated"
    SUCCESS = "success", "Success"
    FAILED = "failed", "Failed"
    ABANDONED = "abandoned", "Abandoned"


class RefundState(models.TextChoices):
    PENDING = "pending", "Pending"
    COMPLETED = "completed", "Completed"
    FAILED = "failed", "Failed"
