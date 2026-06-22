"""Every Ops Console mutation lands in the audit trail (wave-6 mandatory).

Domain transitions append an immutable ``HireEvent``; admin-only mutations call
``self.log_change`` → Django ``LogEntry``. This walks one of each kind and
asserts an audit row is written.
"""

from __future__ import annotations

from typing import cast

import pytest
from django.contrib.admin.models import LogEntry
from django.contrib.admin.sites import AdminSite
from django.test import RequestFactory

from accounts.admin import UserAdmin, VerificationRequestAdmin
from accounts.factories import UserFactory, VerificationRequestFactory
from accounts.models import User, VerificationRequest
from hires.factories import HireFactory
from hires.models import Hire
from listings.admin import ListingAdmin, ReportAdmin
from listings.enums import ListingStatus
from listings.factories import ListingFactory
from listings.models import Listing, Report
from payments.admin import PayoutAdmin
from payments.enums import PayoutKind, PayoutState
from payments.models import Payout
from suppliers.factories import SupplierProfileFactory

pytestmark = pytest.mark.django_db


class _DummyMessages:
    def add(self, *a, **k):
        pass


def _request(user, **post):
    req = RequestFactory().post("/admin/", data=post)
    req.user = user
    req._messages = _DummyMessages()
    return req


@pytest.fixture
def staff(db):
    return UserFactory(staff=True)


def _logentry_count() -> int:
    return LogEntry.objects.count()


def test_user_suspend_writes_logentry(staff):
    target = UserFactory()
    before = _logentry_count()
    UserAdmin(User, AdminSite()).suspend_users(
        _request(staff, apply="1", reason="abuse"), User.objects.filter(pk=target.pk)
    )
    assert _logentry_count() == before + 1


def test_verification_approve_writes_logentry(staff, django_capture_on_commit_callbacks):
    req = VerificationRequestFactory()
    before = _logentry_count()
    with django_capture_on_commit_callbacks(execute=True):
        VerificationRequestAdmin(VerificationRequest, AdminSite()).approve_requests(
            _request(staff), VerificationRequest.objects.filter(pk=req.pk)
        )
    assert _logentry_count() == before + 1


def test_payout_freeze_writes_logentry(staff):
    profile = SupplierProfileFactory()
    hire = cast(Hire, HireFactory(supplier=profile.user))
    payout = Payout.objects.create(
        hire=hire,
        supplier=profile.user,
        amount=hire.payout_amount,
        kind=PayoutKind.COMPLETION,
        state=PayoutState.DUE,
    )
    before = _logentry_count()
    PayoutAdmin(Payout, AdminSite()).freeze_selected(
        _request(staff, apply="1", reason="investigate"), Payout.objects.filter(pk=payout.pk)
    )
    assert _logentry_count() == before + 1


def test_listing_remove_writes_logentry(staff, django_capture_on_commit_callbacks):
    listing = ListingFactory(status=ListingStatus.LIVE)
    before = _logentry_count()
    with django_capture_on_commit_callbacks(execute=True):
        ListingAdmin(Listing, AdminSite()).remove_listings(
            _request(staff, apply="1", reason="fraud"), Listing.objects.filter(pk=listing.pk)
        )
    assert _logentry_count() == before + 1


def test_report_dismiss_writes_logentry(staff):
    listing = ListingFactory(status=ListingStatus.LIVE)
    report = Report.objects.create(listing=listing, reporter=UserFactory(), reason="fraudulent")
    before = _logentry_count()
    ReportAdmin(Report, AdminSite()).resolve_dismiss(
        _request(staff), Report.objects.filter(pk=report.pk)
    )
    assert _logentry_count() == before + 1


def test_hire_admin_cancel_writes_logentry_and_hire_event(
    staff, django_capture_on_commit_callbacks
):
    from hires.admin import HireAdmin
    from hires.models import HireEvent

    hire = cast(Hire, HireFactory(status="requested"))
    before_log = _logentry_count()
    before_events = HireEvent.objects.filter(hire=hire).count()
    with django_capture_on_commit_callbacks(execute=True):
        HireAdmin(Hire, AdminSite()).admin_cancel(
            _request(staff, apply="1", reason="bad listing"), Hire.objects.filter(pk=hire.pk)
        )
    assert _logentry_count() == before_log + 1  # admin LogEntry
    assert HireEvent.objects.filter(hire=hire).count() > before_events  # domain event
