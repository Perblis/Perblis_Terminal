"""Suppliers URL routes, mounted under /api/v1/ (namespace api:suppliers)."""

from __future__ import annotations

from django.urls import path

from suppliers import views

app_name = "suppliers"

urlpatterns = [
    path("suppliers/me/profile", views.SupplierProfileView.as_view(), name="me-profile"),
]
