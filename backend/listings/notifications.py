"""Listing moderation notifications (FSD §9 — supplier email, best-effort).

Sent when Ops act on a listing/report. Delivery never raises into the caller.
"""

from __future__ import annotations

import structlog

from accounts.integrations import email as email_integration

from .models import Listing

logger = structlog.get_logger(__name__)


def _email(to: str, subject: str, body: str) -> None:
    try:
        email_integration.send_email(to=to, subject=subject, body=body)
    except Exception:  # delivery is best-effort; moderation must not fail on it
        logger.exception("listings.notify_failed", to=to, subject=subject)


def notify_listing_removed(listing: Listing, *, reason: str) -> None:
    _email(
        listing.supplier.email,
        "Your Terminal listing was removed",
        f'Your listing "{listing.title}" has been removed by Terminal Ops.\n\n'
        f"Reason: {reason}\n\n"
        "Existing hires are unaffected. Contact support if you believe this is in error.",
    )


def notify_listing_warned(listing: Listing, *, note: str) -> None:
    _email(
        listing.supplier.email,
        "A warning about your Terminal listing",
        f'Terminal Ops reviewed a report about your listing "{listing.title}".\n\n'
        f"{note}\n\n"
        "Please review the listing to keep it accurate and compliant.",
    )
