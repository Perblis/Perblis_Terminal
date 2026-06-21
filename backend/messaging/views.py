"""Messaging API views (thin; all mutation lives in messaging.services)."""

from __future__ import annotations

from drf_spectacular.utils import extend_schema
from rest_framework.generics import GenericAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core import realtime

from . import serializers as s
from . import services


class ConversationListCreateView(GenericAPIView):
    """``GET`` the caller's conversations (+ aggregate unread); ``POST`` an enquiry."""

    permission_classes = [IsAuthenticated]
    serializer_class = s.ConversationSerializer

    @extend_schema(responses={200: s.ConversationSerializer(many=True)})
    def get(self, request):
        conversations = services.conversations_for(request.user)
        page = self.paginate_queryset(conversations)
        data = self.get_serializer(page, many=True, context={"request": request}).data
        response = self.get_paginated_response(data)
        response.data["unread_total"] = services.aggregate_unread(request.user)
        return response

    @extend_schema(request=s.EnquiryCreateSerializer, responses={201: s.ConversationSerializer})
    def post(self, request):
        payload = s.EnquiryCreateSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        conversation = services.create_enquiry(user=request.user, **payload.validated_data)
        body = s.ConversationSerializer(conversation, context={"request": request}).data
        return Response(body, status=201)


class MessageListCreateView(GenericAPIView):
    """``GET`` a conversation's messages (cursor); ``POST`` a new message."""

    permission_classes = [IsAuthenticated]
    serializer_class = s.MessageSerializer

    @extend_schema(responses={200: s.MessageSerializer(many=True)})
    def get(self, request, conversation_id):
        conversation = services.get_participant_conversation(conversation_id, request.user)
        unlocked = services.contact_unlocked(conversation)
        page = self.paginate_queryset(services.messages_for(conversation))
        data = self.get_serializer(page, many=True, context={"unlocked": unlocked}).data
        return self.get_paginated_response(data)

    @extend_schema(request=s.MessageCreateSerializer, responses={201: s.MessageSerializer})
    def post(self, request, conversation_id):
        payload = s.MessageCreateSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        message = services.send_message(
            user=request.user,
            conversation_id=conversation_id,
            body=payload.validated_data["body"],
        )
        unlocked = services.contact_unlocked(message.conversation)
        body = s.MessageSerializer(message, context={"unlocked": unlocked}).data
        return Response(body, status=201)


class MessagesReadView(GenericAPIView):
    """Bulk mark-read for a conversation."""

    permission_classes = [IsAuthenticated]
    serializer_class = s.MarkReadSerializer

    @extend_schema(request=s.MarkReadSerializer, responses={200: None})
    def post(self, request):
        payload = s.MarkReadSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        updated = services.mark_read(
            user=request.user, conversation_id=payload.validated_data["conversation_id"]
        )
        return Response({"marked_read": updated})


class RealtimeTokenView(GenericAPIView):
    """Ably TokenRequest scoped to the caller's own channels (TSD §4).

    Capabilities: ``subscribe`` on each ``conv:{id}`` the caller participates in,
    plus their ``user:{id}`` badge/hire-status channel. Keyless → ``not_configured``
    so clients fall back to 15s polling.
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: None})
    def get(self, request):
        if not realtime.is_configured():
            return Response({"status": "not_configured"})
        user = request.user
        capability = {f"user:{user.id}": ["subscribe"]}
        conv_ids = services.conversations_for(user).values_list("id", flat=True)
        for cid in conv_ids:
            capability[f"conv:{cid}"] = ["subscribe"]
        token_request = realtime.create_token_request(client_id=str(user.id), capability=capability)
        return Response(token_request)
