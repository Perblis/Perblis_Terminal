"""The Ops Console admin site.

The Django admin *is* the Ops Console (FSD §10.3). We keep every existing
``@admin.register(...)`` on the default ``admin.site`` singleton and simply
re-point its class — the documented django-otp pattern
(``admin.site.__class__ = OTPAdminSite``) — so no model needs re-registering.

Two variants:

* ``OpsAdminSite`` — the normal site, plus the dashboard landing page
  (``index`` override, Slice 6B). Used in dev/CI where 2FA is off.
* ``OpsOTPAdminSite`` — the same, with django-otp 2FA enforced (prod).

``core.admin`` performs the swap at admin-autodiscover time based on
``settings.ADMIN_2FA_REQUIRED``.
"""

from __future__ import annotations

from django.contrib import admin
from django_otp.admin import OTPAdminSite


class OpsAdminSite(admin.AdminSite):
    """Ops Console site with the founder dashboard on the landing page (§6.2)."""

    # Distinct name so the template can {% extends "admin/index.html" %} (the
    # stock Django index) without shadowing/recursing into itself.
    index_template = "admin/ops_index.html"

    def index(self, request, extra_context=None):
        # Lazy import: metrics pulls in domain models; importing at module load
        # would run before app registry is ready (admin_site is imported early).
        from ops.services.metrics import dashboard_metrics

        extra_context = {**(extra_context or {}), "ops_dashboard": dashboard_metrics()}
        return super().index(request, extra_context)


class OpsOTPAdminSite(OTPAdminSite, OpsAdminSite):
    """Ops Console with django-otp 2FA enforced.

    MRO resolves the OTP login form / ``has_permission`` (verified-device gate)
    from ``OTPAdminSite`` and the dashboard ``index`` from ``OpsAdminSite``.
    """
