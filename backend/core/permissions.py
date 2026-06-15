"""Role-based permission stubs.

Wired now so later waves attach them to views without re-deriving the role
model. They read the flags/level on the custom User (TSD §3.3).
"""

from __future__ import annotations

from rest_framework.permissions import BasePermission


class IsSupplier(BasePermission):
    message = "A supplier account is required."

    def has_permission(self, request, view) -> bool:
        return bool(request.user and request.user.is_authenticated and request.user.is_supplier)


class IsHirer(BasePermission):
    message = "A hirer account is required."

    def has_permission(self, request, view) -> bool:
        return bool(request.user and request.user.is_authenticated and request.user.is_hirer)


class IsVerified(BasePermission):
    message = "Account verification is required."

    def has_permission(self, request, view) -> bool:
        user = request.user
        return bool(user and user.is_authenticated and user.is_verified)
