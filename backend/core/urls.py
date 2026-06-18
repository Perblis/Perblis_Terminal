"""Core's slice of the /api/v1/ tree.

Mounts the per-app routers (accounts, suppliers, …) plus the cross-cutting
media pipeline endpoints. Each wave adds its app's routes here.
"""

from __future__ import annotations

from django.urls import include, path

from core.views import MediaPresignView, MediaServeView, MediaUploadView

app_name = "api"

urlpatterns = [
    path("", include("accounts.urls")),
    path("", include("suppliers.urls")),
    path("", include("listings.urls")),
    path("", include("search.urls")),
    # Cross-cutting media pipeline (TSD §3.9).
    path("media/presign", MediaPresignView.as_view(), name="media-presign"),
    # Local-mode (dev/CI) upload/serve receivers; prod uses R2 directly.
    path("media/upload", MediaUploadView.as_view(), name="media-upload"),
    path("media/public", MediaServeView.as_view(), name="media-public"),
]
