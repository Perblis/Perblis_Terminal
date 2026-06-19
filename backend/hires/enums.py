"""Hires enums (System Lexicon doc 02 — exact codes)."""

from __future__ import annotations

from django.db import models


class Scheme(models.TextChoices):
    """Pricing scheme that wins the best-price rule (D-008) and sets the fee tier."""

    DAILY = "daily", "Daily"
    WEEKLY = "weekly", "Weekly"
    MONTHLY = "monthly", "Monthly"
