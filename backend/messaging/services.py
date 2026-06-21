"""Messaging services (FSD §8, TSD §3.3/§3.10/§4).

All mutation flows through here (views stay thin). Masking is applied at write
time; the serve choice (``body`` vs ``body_masked``) is computed from the
related hire's status. Realtime fan-out (Ably) is fired post-commit and is
best-effort — Postgres is the message of record, Ably is fan-out only.
"""

from __future__ import annotations

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Q, QuerySet
from django.utils import timezone

from core import realtime
from hires.enums import HireStatus
from listings.models import Listing

from . import errors, masking
from .enums import ConversationKind
from .models import Conversation, Message

User = get_user_model()


# --- reads -----------------------------------------------------------------


def conversations_for(user) -> QuerySet[Conversation]:
    """The caller's conversations (either party), newest activity first."""
    return (
        Conversation.objects.filter(Q(hirer=user) | Q(supplier=user))
        .select_related(
            "listing",
            "listing__yard",
            "hire",
            "supplier",
            "supplier__supplier_profile",
            "hirer",
        )
        .order_by("-last_message_at", "-created_at")
    )


def get_participant_conversation(conversation_id, user) -> Conversation:
    """Fetch a conversation the user is a party to, else 404 (no existence leak).

    Ops visibility is deferred to the dispute context (Wave 6); for now only the
    two parties can read a conversation.
    """
    try:
        conversation = Conversation.objects.select_related(
            "listing", "hire", "supplier", "hirer"
        ).get(id=conversation_id)
    except Conversation.DoesNotExist as exc:
        raise errors.ConversationNotFound() from exc
    if user.id not in (conversation.hirer_id, conversation.supplier_id):
        raise errors.ConversationNotFound()
    return conversation


def messages_for(conversation: Conversation) -> QuerySet[Message]:
    return conversation.messages.select_related("sender").all()


def contact_unlocked(conversation: Conversation) -> bool:
    """True when this conversation may serve original (unmasked) bodies.

    Enquiry conversations are masked indefinitely. A hire conversation unlocks
    once its hire has **ever** reached Confirmed (payment success) — the only
    path into Confirmed — and stays unlocked thereafter (events are append-only),
    so a later cancel/dispute never re-masks (FSD §8 acceptance).
    """
    if conversation.kind != ConversationKind.HIRE or conversation.hire_id is None:
        return False
    return conversation.hire.events.filter(to_status=str(HireStatus.CONFIRMED)).exists()


def unread_count(conversation: Conversation, user) -> int:
    return conversation.messages.filter(read_at__isnull=True).exclude(sender=user).count()


def aggregate_unread(user) -> int:
    """Total unread across all of the caller's conversations."""
    return (
        Message.objects.filter(Q(conversation__hirer=user) | Q(conversation__supplier=user))
        .filter(read_at__isnull=True)
        .exclude(sender=user)
        .count()
    )


def counterparty(conversation: Conversation, user):
    """The other party to ``user`` in this conversation."""
    return conversation.supplier if user.id == conversation.hirer_id else conversation.hirer


# --- writes ----------------------------------------------------------------


@transaction.atomic
def create_enquiry(*, user, listing_id=None, supplier_id=None) -> Conversation:
    """Open (or return the existing) enquiry conversation. Hirer-initiated;
    idempotent on the unique indexes. Exactly one of listing/supplier."""
    if bool(listing_id) == bool(supplier_id):
        raise errors.InvalidEnquiryTarget()

    if listing_id:
        try:
            listing = Listing.objects.select_related("supplier").get(id=listing_id)
        except Listing.DoesNotExist as exc:
            raise errors.ConversationNotFound() from exc
        if listing.supplier_id == user.id:
            raise errors.CannotEnquireOwnListing()
        conversation, _ = Conversation.objects.get_or_create(
            kind=ConversationKind.ENQUIRY,
            listing=listing,
            hirer=user,
            defaults={"supplier": listing.supplier},
        )
        return conversation

    # storefront "general" enquiry (no listing)
    try:
        supplier = User.objects.get(id=supplier_id, is_supplier=True)
    except User.DoesNotExist as exc:
        raise errors.ConversationNotFound() from exc
    if supplier.id == user.id:
        raise errors.CannotEnquireOwnListing()
    conversation, _ = Conversation.objects.get_or_create(
        kind=ConversationKind.ENQUIRY,
        listing__isnull=True,
        supplier=supplier,
        hirer=user,
        defaults={"listing": None},
    )
    return conversation


@transaction.atomic
def send_message(*, user, conversation_id, body: str) -> Message:
    """Append a message: mask at write, bump the conversation, fan out post-commit."""
    body = (body or "").strip()
    if not body:
        raise errors.EmptyMessage()
    conversation = get_participant_conversation(conversation_id, user)
    message = Message.objects.create(
        conversation=conversation,
        sender=user,
        body=body,
        body_masked=masking.mask(body),
    )
    conversation.last_message_at = message.created_at
    conversation.save(update_fields=["last_message_at", "updated_at"])

    other = counterparty(conversation, user)
    unlocked = contact_unlocked(conversation)
    preview = message.body if unlocked else message.body_masked

    def _fanout() -> None:
        realtime.publish(
            f"conv:{conversation.id}",
            "message",
            {
                "conversation_id": str(conversation.id),
                "message_id": str(message.id),
                "sender_id": str(user.id),
                "preview": preview,
            },
        )
        realtime.publish(
            f"user:{other.id}",
            "unread",
            {
                "conversation_id": str(conversation.id),
                "unread": unread_count(conversation, other),
                "unread_total": aggregate_unread(other),
            },
        )

    transaction.on_commit(_fanout)
    return message


@transaction.atomic
def mark_read(*, user, conversation_id) -> int:
    """Bulk mark-read: stamp ``read_at`` on the counterparty's unread messages."""
    conversation = get_participant_conversation(conversation_id, user)
    now = timezone.now()
    updated = (
        conversation.messages.filter(read_at__isnull=True).exclude(sender=user).update(read_at=now)
    )
    if updated:

        def _fanout() -> None:
            realtime.publish(
                f"user:{user.id}",
                "unread",
                {
                    "conversation_id": str(conversation.id),
                    "unread": 0,
                    "unread_total": aggregate_unread(user),
                },
            )

        transaction.on_commit(_fanout)
    return updated


def ensure_hire_conversation(hire) -> Conversation:
    """Idempotently create the hire's conversation (Wave 4C hookup).

    Called from ``hires.services.accept_hire`` post-commit. Safe under retried
    transitions and the backfill command — the ``hire`` OneToOne is unique.
    """
    conversation, _ = Conversation.objects.get_or_create(
        hire=hire,
        defaults={
            "kind": ConversationKind.HIRE,
            "listing": hire.listing,
            "supplier": hire.supplier,
            "hirer": hire.hirer,
        },
    )
    return conversation
