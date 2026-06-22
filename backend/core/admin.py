"""Ops Console identity.

The Django admin is the **Ops Console** (lexicon doc 02) — the founder/staff
cockpit, not a generic "Django administration" panel. These site-level labels
are configuration (not per-ModelAdmin changes) and are picked up because
`core` is in INSTALLED_APPS and admin autodiscover imports this module.
"""

from __future__ import annotations

from django.conf import settings
from django.contrib import admin

from ops.admin_site import OpsAdminSite, OpsOTPAdminSite

admin.site.site_header = "Terminal Ops Console"
admin.site.site_title = "Terminal Ops"
admin.site.index_title = "Operations"

# Re-point the default admin site to the Ops Console site without re-registering
# any ModelAdmin (the registry lives on the singleton, unaffected by the class
# swap). With ADMIN_2FA_REQUIRED on (prod), this enforces django-otp TOTP login.
admin.site.__class__ = OpsOTPAdminSite if settings.ADMIN_2FA_REQUIRED else OpsAdminSite
