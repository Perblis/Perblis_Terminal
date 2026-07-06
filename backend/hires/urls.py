"""Hires URL routes, mounted under /api/v1/ (namespace api:hires)."""

from __future__ import annotations

from django.urls import path

from hires import views

app_name = "hires"

urlpatterns = [
    path("hires", views.HireListCreateView.as_view(), name="list-create"),
    path("hires/stats", views.HireStatsView.as_view(), name="stats"),
    path("hires/events", views.HireEventsView.as_view(), name="events"),
    path("hires/<uuid:hire_id>", views.HireDetailView.as_view(), name="detail"),
    path("hires/<uuid:hire_id>/accept", views.HireAcceptView.as_view(), name="accept"),
    path("hires/<uuid:hire_id>/decline", views.HireDeclineView.as_view(), name="decline"),
    path("hires/<uuid:hire_id>/cancel", views.HireCancelView.as_view(), name="cancel"),
    path("hires/<uuid:hire_id>/payment", views.HirePaymentView.as_view(), name="payment"),
    path(
        "hires/<uuid:hire_id>/refund-preview",
        views.HireRefundPreviewView.as_view(),
        name="refund-preview",
    ),
    path("hires/<uuid:hire_id>/handovers", views.HireHandoverView.as_view(), name="handovers"),
    path(
        "handovers/<uuid:handover_id>/confirm",
        views.HandoverConfirmView.as_view(),
        name="handover-confirm",
    ),
    path("hires/<uuid:hire_id>/dispute", views.HireDisputeView.as_view(), name="dispute"),
    path(
        "hires/<uuid:hire_id>/resolve-dispute",
        views.HireResolveDisputeView.as_view(),
        name="resolve-dispute",
    ),
]
