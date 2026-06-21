"""Messaging models (FSD §8, TSD §3.3, §3.10).

Two-party conversations with **permanent history** (no edits, no deletes of
content). Enquiry conversations are listing-level or storefront "general"
(no listing); hire conversations are auto-created at acceptance and carry the
``hire`` OneToOne. Contact masking is applied **server-side at write time**:
``body`` retains the original (Ops/dispute visibility) and ``body_masked`` holds
the redacted copy. The serve choice (``body`` vs ``body_masked``) is decided at
read time from the related hire's status — see ``messaging.services``.
"""

from __future__ import annotations

from django.conf import settings
from django.db import models

from core.models import BaseModel

from .enums import ConversationKind


class Conversation(BaseModel):
    """A two-party thread between a hirer and a supplier (FSD §8)."""

    kind = models.CharField(max_length=16, choices=ConversationKind.choices)
    # Enquiry: listing-level (listing set) or storefront "general" (listing null).
    listing = models.ForeignKey(
        "listings.Listing",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="conversations",
    )
    # Hire conversations carry the hire; enquiry conversations leave it null.
    hire = models.OneToOneField(
        "hires.Hire",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="conversation",
    )
    supplier = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="conversations_as_supplier",
    )
    hirer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="conversations_as_hirer",
    )
    # Denormalised for the conversation-list sort + preview (bumped on each send).
    last_message_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-last_message_at", "-created_at"]
        constraints = [
            # One listing enquiry per (listing, hirer) — TSD §3.3.
            models.UniqueConstraint(
                fields=["listing", "hirer"],
                condition=models.Q(kind="enquiry", listing__isnull=False),
                name="uniq_enquiry_per_listing_hirer",
            ),
            # One open storefront "general" enquiry per (supplier, hirer) so the
            # client-side get-or-create is idempotent (consistent with the
            # one-per-(listing,hirer) intent; the general case is unspecified in
            # TSD §3.3 — chosen for idempotency).
            models.UniqueConstraint(
                fields=["supplier", "hirer"],
                condition=models.Q(kind="enquiry", listing__isnull=True),
                name="uniq_general_enquiry_per_supplier_hirer",
            ),
        ]
        indexes = [
            models.Index(fields=["hirer", "-last_message_at"]),
            models.Index(fields=["supplier", "-last_message_at"]),
        ]

    def __str__(self) -> str:
        return f"Conversation {self.id} ({self.kind})"


class Message(BaseModel):
    """One message in a conversation. ``body`` is immutable (history is
    permanent); only ``read_at`` mutates, via the bulk mark-read service."""

    conversation = models.ForeignKey(
        Conversation, on_delete=models.PROTECT, related_name="messages"
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="messages_sent"
    )
    body = models.TextField()  # original — retained for Ops/dispute (TSD §3.10)
    body_masked = models.TextField(blank=True)  # redacted copy stored at write time
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["created_at"]
        indexes = [
            models.Index(fields=["conversation", "created_at"]),
            # Unread lookup: messages in a conversation not yet read.
            models.Index(fields=["conversation", "read_at"]),
        ]

    def __str__(self) -> str:
        return f"Message {self.id} in {self.conversation_id}"
