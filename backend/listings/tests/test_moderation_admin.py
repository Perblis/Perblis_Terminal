"""Ops listing & report moderation (wave-6 §6.5)."""

from __future__ import annotations

from typing import cast

import pytest
from django.contrib.admin.sites import AdminSite
from django.core import mail

from accounts.factories import UserFactory
from hires.factories import HireFactory
from hires.models import Hire
from listings.admin import ListingAdmin, ReportAdmin
from listings.enums import ListingStatus, ListingTier, ReportState
from listings.errors import InvalidTransition
from listings.factories import ListingFactory
from listings.models import Listing, Report
from listings.services import moderation

pytestmark = pytest.mark.django_db


class _DummyMessages:
    def add(self, *a, **k):
        pass


def _request(staff, **post):
    from django.test import RequestFactory

    req = RequestFactory().post("/admin/", data=post)
    req.user = staff
    req._messages = _DummyMessages()
    return req


@pytest.fixture
def staff(db):
    return UserFactory(staff=True)


# --- service-level ----------------------------------------------------------
def test_remove_requires_reason():
    listing = ListingFactory(status=ListingStatus.LIVE)
    with pytest.raises(InvalidTransition):
        moderation.remove_listing(listing, reason="   ")


def test_remove_sets_status_notifies_and_preserves_hires(django_capture_on_commit_callbacks):
    listing = ListingFactory(status=ListingStatus.LIVE)
    hire = cast(Hire, HireFactory(listing=listing))
    with django_capture_on_commit_callbacks(execute=True):
        moderation.remove_listing(listing, reason="Fraudulent listing")
    listing.refresh_from_db()
    assert listing.status == ListingStatus.REMOVED
    assert listing.removed_reason == "Fraudulent listing"
    assert Hire.objects.filter(pk=hire.pk).exists()  # hire history preserved
    assert any("removed" in m.subject.lower() for m in mail.outbox)


def test_award_tier_changes_tier_only():
    listing = ListingFactory(status=ListingStatus.LIVE, tier=ListingTier.BASIC)
    moderation.award_tier(listing, tier=ListingTier.INSPECTED)
    listing.refresh_from_db()
    assert listing.tier == ListingTier.INSPECTED
    assert listing.status == ListingStatus.LIVE


def test_award_tier_rejects_unknown():
    listing = ListingFactory(status=ListingStatus.LIVE)
    with pytest.raises(InvalidTransition):
        moderation.award_tier(listing, tier="platinum")


# --- report resolution ------------------------------------------------------
def _open_report() -> Report:
    listing = ListingFactory(status=ListingStatus.LIVE)
    return Report.objects.create(listing=listing, reporter=UserFactory(), reason="fraudulent")


def test_report_dismiss(staff):
    report = _open_report()
    ReportAdmin(Report, AdminSite()).resolve_dismiss(
        _request(staff), Report.objects.filter(pk=report.pk)
    )
    report.refresh_from_db()
    assert report.state == ReportState.DISMISSED


def test_report_warn_emails_supplier(staff, django_capture_on_commit_callbacks):
    report = _open_report()
    request = _request(staff, apply="1", note="Please fix the description.")
    with django_capture_on_commit_callbacks(execute=True):
        ReportAdmin(Report, AdminSite()).resolve_warn(request, Report.objects.filter(pk=report.pk))
    report.refresh_from_db()
    assert report.state == ReportState.WARNED
    assert report.resolution_note == "Please fix the description."
    assert any("warning" in m.subject.lower() for m in mail.outbox)


def test_report_remove_takes_down_listing(staff, django_capture_on_commit_callbacks):
    report = _open_report()
    request = _request(staff, apply="1", note="Duplicate fake listing")
    with django_capture_on_commit_callbacks(execute=True):
        ReportAdmin(Report, AdminSite()).resolve_remove(
            request, Report.objects.filter(pk=report.pk)
        )
    report.refresh_from_db()
    report.listing.refresh_from_db()
    assert report.state == ReportState.REMOVED
    assert report.listing.status == ListingStatus.REMOVED


# --- listing admin actions --------------------------------------------------
def test_pause_action(staff):
    listing = ListingFactory(status=ListingStatus.LIVE)
    ListingAdmin(Listing, AdminSite()).pause_listings(
        _request(staff), Listing.objects.filter(pk=listing.pk)
    )
    listing.refresh_from_db()
    assert listing.status == ListingStatus.PAUSED
