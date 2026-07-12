"""Payments URL routes, mounted under /api/v1/ (namespace api:payments)."""

from __future__ import annotations

from django.urls import path

from payments import views

app_name = "payments"

urlpatterns = [
    path("payments/webhook", views.PaymentWebhookView.as_view(), name="webhook"),
    # Post-checkout browser landing (UX only — never marks anything paid).
    path("payments/return", views.PaymentReturnView.as_view(), name="return"),
    path("payments/payouts", views.SupplierPayoutListView.as_view(), name="payouts"),
]
