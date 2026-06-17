"""Suppliers-specific domain errors (stable codes for the error envelope)."""

from __future__ import annotations

from rest_framework import status

from core.exceptions import TerminalError


class YardHasListings(TerminalError):
    status_code = status.HTTP_409_CONFLICT
    default_code = "yard_has_listings"
    default_detail = "This yard has listings attached; move or remove them first."
