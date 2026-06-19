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


class PayoutState(models.TextChoices):
    PENDING = "pending", "Pending"
    DUE = "due", "Due"
    PAID = "paid", "Paid"
    FROZEN = "frozen", "Frozen"


class PayoutKind(models.TextChoices):
    COMPLETION = "completion", "Completion"
    # The withheld day on a ≤72h hirer cancellation (D-015 exception).
    WITHHELD_DAY = "withheld_day", "Withheld day"
