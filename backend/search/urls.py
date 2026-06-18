"""Search URL routes, mounted under /api/v1/ (namespace api:search)."""

from __future__ import annotations

from django.urls import path

from search import views

app_name = "search"

urlpatterns = [
    path("search/map", views.MapSearchView.as_view(), name="map"),
]
