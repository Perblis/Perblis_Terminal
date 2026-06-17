"""Ops Console identity.

The Django admin is the **Ops Console** (lexicon doc 02) — the founder/staff
cockpit, not a generic "Django administration" panel. These site-level labels
are configuration (not per-ModelAdmin changes) and are picked up because
`core` is in INSTALLED_APPS and admin autodiscover imports this module.
"""

from __future__ import annotations

from django.contrib import admin

admin.site.site_header = "Terminal Ops Console"
admin.site.site_title = "Terminal Ops"
admin.site.index_title = "Operations"
