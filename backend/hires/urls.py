"""Hires URL routes, mounted under /api/v1/ (namespace api:hires)."""

from __future__ import annotations

from django.urls import path

from hires import views

app_name = "hires"

urlpatterns = [
    path("hires", views.HireListCreateView.as_view(), name="list-create"),
    path("hires/<uuid:hire_id>", views.HireDetailView.as_view(), name="detail"),
    path("hires/<uuid:hire_id>/accept", views.HireAcceptView.as_view(), name="accept"),
    path("hires/<uuid:hire_id>/decline", views.HireDeclineView.as_view(), name="decline"),
    path("hires/<uuid:hire_id>/cancel", views.HireCancelView.as_view(), name="cancel"),
    path("hires/<uuid:hire_id>/payment", views.HirePaymentView.as_view(), name="payment"),
]
