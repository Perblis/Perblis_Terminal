"""Messaging enums (System Lexicon doc 02, TSD §3.3)."""

from __future__ import annotations

from django.db import models


class ConversationKind(models.TextChoices):
    """Two kinds (TSD §3.3). Enquiry vs hire; listing-vs-general enquiry is
    distinguished by ``listing`` nullability, not a separate kind."""

    ENQUIRY = "enquiry", "Enquiry"
    HIRE = "hire", "Hire"
