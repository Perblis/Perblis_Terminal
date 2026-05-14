"""Absolute media URLs for API JSON (owner-web, mobile, map clients)."""

from __future__ import annotations

from typing import Any

from django.conf import settings


def _normalize_relative_storage_path(url: str) -> str:
    """
    Some deployments expose storage paths as `listings/...` without MEDIA_URL.
    Browsers then resolve them under the site root (`/listings/...`), which
    Django does not serve in production. Prefix MEDIA_URL when applicable.
    """
    if url.startswith(("http://", "https://")):
        return url
    media = (getattr(settings, "MEDIA_URL", None) or "/media/").strip()
    if not media.startswith("/"):
        media = "/" + media
    if not media.endswith("/"):
        media += "/"
    stripped = url.lstrip("/")
    if stripped.startswith("listings/") and not url.startswith(media.rstrip("/")):
        return f"{media}{stripped}"
    return url if url.startswith("/") else f"/{url}"


def absolute_media_url(request: Any | None, url: str | None) -> str | None:
    """Turn a storage URL or site-relative path into an absolute URL."""
    if not url:
        return None
    url = _normalize_relative_storage_path(url)
    if url.startswith(("http://", "https://")):
        return url
    if request is None:
        return url
    return request.build_absolute_uri(url)


def absolute_file_field(request: Any | None, file_field: Any) -> str | None:
    """Absolute URL for an ImageField/FileField (handles ValueError for missing files)."""
    if not file_field:
        return None
    try:
        raw = file_field.url
    except ValueError:
        return None
    return absolute_media_url(request, raw)
