"""Messaging URL routes, mounted under /api/v1/ (namespace api:messaging)."""

from __future__ import annotations

from django.urls import path

from messaging import views

app_name = "messaging"

urlpatterns = [
    path("conversations", views.ConversationListCreateView.as_view(), name="list-create"),
    path(
        "conversations/<uuid:conversation_id>/messages",
        views.MessageListCreateView.as_view(),
        name="messages",
    ),
    path("messages/read", views.MessagesReadView.as_view(), name="messages-read"),
    path("realtime/token", views.RealtimeTokenView.as_view(), name="realtime-token"),
]
