"""Accounts URL routes, mounted under /api/v1/ (namespace api:accounts)."""

from __future__ import annotations

from django.urls import path

from accounts import views

app_name = "accounts"

urlpatterns = [
    # Auth
    path("auth/register", views.RegisterView.as_view(), name="register"),
    path("auth/otp/verify", views.OtpVerifyView.as_view(), name="otp-verify"),
    path("auth/otp/resend", views.OtpResendView.as_view(), name="otp-resend"),
    path("auth/email/verify", views.EmailOtpVerifyView.as_view(), name="email-verify"),
    path("auth/email/resend", views.EmailOtpResendView.as_view(), name="email-resend"),
    path("auth/login", views.LoginView.as_view(), name="login"),
    path("auth/token/refresh", views.RefreshView.as_view(), name="token-refresh"),
    path("auth/logout", views.LogoutView.as_view(), name="logout"),
    path(
        "auth/password-reset",
        views.PasswordResetRequestView.as_view(),
        name="password-reset",
    ),
    path(
        "auth/password-reset/confirm",
        views.PasswordResetConfirmView.as_view(),
        name="password-reset-confirm",
    ),
    # Me & roles
    path("me", views.MeView.as_view(), name="me"),
    path("me/activate-supplier", views.ActivateSupplierView.as_view(), name="activate-supplier"),
    path("me/verification", views.VerificationView.as_view(), name="verification"),
    # Ops-only local-media stream (no public path to private docs)
    path("private-doc", views.PrivateDocView.as_view(), name="private-doc"),
]
