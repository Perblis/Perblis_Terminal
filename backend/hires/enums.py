"""Hires enums (System Lexicon doc 02 — exact codes)."""

from __future__ import annotations

from django.db import models


class Scheme(models.TextChoices):
    """Pricing scheme that wins the best-price rule (D-008) and sets the fee tier."""

    DAILY = "daily", "Daily"
    WEEKLY = "weekly", "Weekly"
    MONTHLY = "monthly", "Monthly"


class HireStatus(models.TextChoices):
    """The seven-state hire lifecycle (FSD §7.3, normative)."""

    REQUESTED = "requested", "Requested"
    ACCEPTED = "accepted", "Accepted"
    CONFIRMED = "confirmed", "Confirmed"
    ON_HIRE = "on_hire", "On Hire"
    COMPLETED = "completed", "Completed"
    DECLINED = "declined", "Declined"
    EXPIRED = "expired", "Expired"
    CANCELLED = "cancelled", "Cancelled"
    IN_DISPUTE = "in_dispute", "In Dispute"


class ActorKind(models.TextChoices):
    """Who drove a transition — recorded on every hire event."""

    USER = "user", "User"
    SYSTEM = "system", "System"
    OPS = "ops", "Ops"


class CancelledBy(models.TextChoices):
    HIRER = "hirer", "Hirer"
    SUPPLIER = "supplier", "Supplier"
    OPS = "ops", "Ops"
    SYSTEM = "system", "System"


class HandoverKind(models.TextChoices):
    ON_HIRE = "on_hire", "On Hire"
    OFF_HIRE = "off_hire", "Off Hire"
