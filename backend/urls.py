"""Root URL configuration.

API routes live under `/api/v1/`. Health probes and the OpenAPI schema sit
at the root so platform health checks and tooling can reach them directly.
"""

from __future__ import annotations

from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from core.health import healthz, readyz

urlpatterns = [
    path("admin/", admin.site.urls),
    # Health probes (TSD §2.3 — used by Railway and load checks).
    path("healthz", healthz, name="healthz"),
    path("readyz", readyz, name="readyz"),
    # OpenAPI schema + docs.
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path(
        "api/docs/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),
    # Versioned API root. Module routers are added by later waves.
    path("api/v1/", include("core.urls")),
]
