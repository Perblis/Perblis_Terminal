"""Ops Console hires admin: dispute resolution + admin cancel (wave-6 §6.6)."""

from __future__ import annotations

import datetime as dt
from typing import cast

import pytest
from django.contrib.admin.sites import AdminSite
from django.test import RequestFactory
from django.utils import timezone

from accounts.factories import UserFactory
from hires import services
from hires.admin import HireAdmin
from hires.enums import HireStatus
from hires.factories import HireFactory
from hires.models import Hire, HireEvent
from listings.enums import ListingStatus
from listings.factories import ListingFactory
from payments.enums import PaymentState, PayoutState
from payments.models import Payment, Payout

pytestmark = pytest.mark.django_db


class _DummyMessages:
    def add(self, *a, **k):
        pass


@pytest.fixture
def staff(db):
    return UserFactory(staff=True)


def _request(user, **post):
    req = RequestFactory().post("/admin/", data=post)
    req.user = user
    req._messages = _DummyMessages()
    return req


def _disputed_hire() -> Hire:
    listing = ListingFactory(status=ListingStatus.LIVE, unit_count=1)
    start = timezone.localdate() - dt.timedelta(days=3)
    hire = cast(
        Hire,
        HireFactory(
            listing=listing,
            start_date=start,
            end_date=start + dt.timedelta(days=2),
            status=HireStatus.ON_HIRE,
        ),
    )
    Payment.objects.create(
        hire=hire,
        reference=f"THR-{hire.id.hex[:12]}",
        amount=hire.hire_value,
        state=PaymentState.SUCCESS,
        paid_at=timezone.now(),
    )
    services.raise_dispute(user=hire.hirer, hire_id=hire.id, reason="Damage claim")
    return hire


def _admin() -> HireAdmin:
    return HireAdmin(Hire, AdminSite())


def test_resolve_complete_via_admin(staff, django_capture_on_commit_callbacks):
    hire = _disputed_hire()
    request = _request(staff, apply="1", reason="Evidence favours supplier")
    with django_capture_on_commit_callbacks(execute=True):
        _admin().resolve_complete(request, Hire.objects.filter(pk=hire.pk))
    hire.refresh_from_db()
    assert hire.status == HireStatus.COMPLETED
    # Payout queued and unfrozen (due) on resolution to completed.
    payout = Payout.objects.get(hire=hire)
    assert payout.state == PayoutState.DUE
    # Ops mutation is event-logged.
    assert HireEvent.objects.filter(hire=hire, to_status=HireStatus.COMPLETED).exists()


def test_resolve_cancel_via_admin(staff, django_capture_on_commit_callbacks):
    hire = _disputed_hire()
    request = _request(staff, apply="1", reason="Refund the hirer")
    with django_capture_on_commit_callbacks(execute=True):
        _admin().resolve_cancel(request, Hire.objects.filter(pk=hire.pk))
    hire.refresh_from_db()
    assert hire.status == HireStatus.CANCELLED
    assert HireEvent.objects.filter(hire=hire, to_status=HireStatus.CANCELLED).exists()


def test_admin_cancel_requires_reason_form(staff):
    """Without 'apply' the action returns the reason form, not a mutation."""
    hire = cast(Hire, HireFactory(status=HireStatus.REQUESTED))
    response = _admin().admin_cancel(_request(staff), Hire.objects.filter(pk=hire.pk))
    assert response is not None  # intermediate form rendered
    hire.refresh_from_db()
    assert hire.status == HireStatus.REQUESTED  # unchanged


def test_admin_cancel_applies(staff, django_capture_on_commit_callbacks):
    hire = cast(Hire, HireFactory(status=HireStatus.REQUESTED))
    request = _request(staff, apply="1", reason="Listing was fraudulent")
    with django_capture_on_commit_callbacks(execute=True):
        _admin().admin_cancel(request, Hire.objects.filter(pk=hire.pk))
    hire.refresh_from_db()
    assert hire.status == HireStatus.CANCELLED
    assert HireEvent.objects.filter(hire=hire, to_status=HireStatus.CANCELLED).exists()


def test_money_invariant_clean_after_settled_completion(staff):
    """A completed hire with its payout PAID nets to zero (no red flag)."""
    hire = _disputed_hire()
    services.resolve_dispute(user=staff, hire_id=hire.id, outcome="complete", reason="ok")
    payout = Payout.objects.get(hire=hire)
    from payments.services import mark_payout_paid

    mark_payout_paid(payout, reference="ZEN-1")
    hire.refresh_from_db()
    rendered = str(_admin().money_invariant(hire))
    assert "color:#B91C1C" not in rendered  # balanced once settled
