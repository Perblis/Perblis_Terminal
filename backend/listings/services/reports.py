"""Listing report service (FSD §5.2).

Authenticated hirers report Live listings. Reports never auto-hide a listing;
3 reports in 30 days raise its ``priority_review_flag`` for the Ops queue.
"""

from __future__ import annotations

from datetime import timedelta

from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone

from accounts.models import User
from listings import notifications
from listings.enums import ListingStatus, ReportState
from listings.errors import InvalidTransition, ListingNotReportable
from listings.models import Listing, Report
from listings.services import moderation

REPORT_WINDOW = timedelta(days=30)
PRIORITY_THRESHOLD = 3


@transaction.atomic
def create_report(*, user: User, listing_id, reason: str, note: str = "") -> Report:
    listing = get_object_or_404(Listing.objects.select_for_update(), id=listing_id)
    # Only Live listings are reportable; otherwise behave as not-found.
    if listing.status != ListingStatus.LIVE:
        raise ListingNotReportable()

    report = Report.objects.create(listing=listing, reporter=user, reason=reason, note=note)

    listing.report_count = listing.reports.count()
    recent = listing.reports.filter(created_at__gte=timezone.now() - REPORT_WINDOW).count()
    if recent >= PRIORITY_THRESHOLD:
        listing.priority_review_flag = True
    listing.save(update_fields=["report_count", "priority_review_flag", "updated_at"])
    return report


@transaction.atomic
def resolve_report(report: Report, *, outcome: str, note: str = "") -> Report:
    """Ops resolves a report (wave-6 §6.5): dismissed | warned | removed.

    ``warned`` emails the supplier a warning; ``removed`` requires a reason and
    takes the listing down (supplier notified, hire history preserved).
    """
    if outcome == ReportState.DISMISSED:
        report.state = ReportState.DISMISSED
    elif outcome == ReportState.WARNED:
        report.state = ReportState.WARNED
        transaction.on_commit(
            lambda: notifications.notify_listing_warned(report.listing, note=note)
        )
    elif outcome == ReportState.REMOVED:
        if not note.strip():
            raise InvalidTransition()  # removal reason is mandatory
        moderation.remove_listing(report.listing, reason=note)
        report.state = ReportState.REMOVED
    else:
        raise InvalidTransition()

    report.resolution_note = note
    report.save(update_fields=["state", "resolution_note", "updated_at"])
    return report
