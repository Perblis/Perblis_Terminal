"""Messaging serializers (FSD §8).

The message serializer enforces the serve rule: pre-unlock it emits **only**
``body_masked`` under the ``body`` key — the original is never serialized to a
client until the conversation is unlocked. Whether a conversation is unlocked is
computed once in the view and passed via serializer context.
"""

from __future__ import annotations

from rest_framework import serializers

from core import media

from .models import Conversation, Message


class MessageSerializer(serializers.Serializer):
    id = serializers.UUIDField(read_only=True)
    conversation_id = serializers.UUIDField(read_only=True)
    sender_id = serializers.UUIDField(read_only=True)
    body = serializers.SerializerMethodField()
    masked = serializers.SerializerMethodField()
    sent_at = serializers.DateTimeField(source="created_at", read_only=True)
    read_at = serializers.DateTimeField(read_only=True)

    def _unlocked(self) -> bool:
        return bool(self.context.get("unlocked"))

    def get_body(self, obj: Message) -> str:
        # Pre-unlock the original never leaves the server.
        return obj.body if self._unlocked() else obj.body_masked

    def get_masked(self, obj: Message) -> bool:
        # True only when we actually withheld contact detail (so clients show the
        # 🔒 explainer); a benign message served masked-but-identical isn't flagged.
        return (not self._unlocked()) and obj.body_masked != obj.body


class CounterpartySerializer(serializers.Serializer):
    id = serializers.UUIDField()
    name = serializers.CharField()
    verified = serializers.BooleanField()


class ConversationSerializer(serializers.Serializer):
    """A conversation-list row (FSD §8). ``unread_count`` and the masked preview
    are computed for the requesting user (passed via context ``request``)."""

    id = serializers.UUIDField(read_only=True)
    kind = serializers.CharField(read_only=True)
    counterparty = serializers.SerializerMethodField()
    listing = serializers.SerializerMethodField()
    yard_name = serializers.SerializerMethodField()
    last_message_preview = serializers.SerializerMethodField()
    last_message_at = serializers.DateTimeField(read_only=True)
    unread_count = serializers.SerializerMethodField()

    def _user(self):
        request = self.context.get("request")
        return getattr(request, "user", None)

    def _is_hirer(self, obj: Conversation) -> bool:
        user = self._user()
        return bool(user and user.id == obj.hirer_id)

    def get_counterparty(self, obj: Conversation) -> dict:
        other = obj.supplier if self._is_hirer(obj) else obj.hirer
        # Supplier counterparties present their business name when set.
        name = other.full_name
        if other.id == obj.supplier_id:
            profile = getattr(other, "supplier_profile", None)
            if profile and profile.business_name:
                name = profile.business_name
        return {"id": other.id, "name": name, "verified": other.is_verified}

    def get_listing(self, obj: Conversation) -> dict | None:
        if obj.listing_id is None:
            return None  # client renders "General enquiry"
        listing = obj.listing
        cover = next((p for p in listing.photos.all() if p.is_cover), None)
        if cover is None:
            cover = listing.photos.first()
        return {
            "id": listing.id,
            "title": listing.title,
            "thumb_url": media.public_url(cover.r2_key) if cover else None,
        }

    def get_yard_name(self, obj: Conversation) -> str | None:
        if obj.listing_id and obj.listing.yard_id:
            return obj.listing.yard.name
        return None

    def get_last_message_preview(self, obj: Conversation) -> str | None:
        from . import services

        last = obj.messages.order_by("-created_at").first()
        if last is None:
            return None
        return last.body if services.contact_unlocked(obj) else last.body_masked

    def get_unread_count(self, obj: Conversation) -> int:
        from . import services

        user = self._user()
        return services.unread_count(obj, user) if user else 0


class EnquiryCreateSerializer(serializers.Serializer):
    listing_id = serializers.UUIDField(required=False)
    supplier_id = serializers.UUIDField(required=False)


class MessageCreateSerializer(serializers.Serializer):
    # The service owns the empty check (stable ``empty_message`` code), so let
    # blank/whitespace through the serializer untrimmed.
    body = serializers.CharField(allow_blank=True, trim_whitespace=False)


class MarkReadSerializer(serializers.Serializer):
    conversation_id = serializers.UUIDField()
