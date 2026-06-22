"""Ops Console payout queue admin (wave-6 §6.4).

Mandatory tests: mark-paid stores the reference + emails the supplier + state→paid;
freeze blocks mark-paid; the full bank number is shown only here and masked in
the supplier admin.
"""

from __future__ import annotations

from typing import cast

import pytest
from django.contrib.admin.sites import AdminSite
from django.core import mail
from django.test import RequestFactory
from django.utils import timezone

from hires.factories import HireFactory
from hires.models import Hire
from payments.admin import PayoutAdmin
from payments.enums import PaymentState, PayoutKind, PayoutState
from payments.models import Payment, Payout
from suppliers.admin import SupplierProfileAdmin
from suppliers.factories import SupplierProfileFactory
from suppliers.models import SupplierProfile

pytestmark = pytest.mark.django_db

BANK_NUMBER = "0123456789"


@pytest.fixture
def staff_user(db):
    from accounts.factories import UserFactory

    return UserFactory(staff=True)


class _DummyMessages:
    def add(self, *a, **k):
        pass


def _request(staff_user, **post):
    req = RequestFactory().post("/admin/", data=post)
    req.user = staff_user
    req._messages = _DummyMessages()
    return req


def _payout(*, state=PayoutState.DUE) -> Payout:
    profile = SupplierProfileFactory(bank_account_number_enc=BANK_NUMBER)
    hire = cast(Hire, HireFactory(supplier=profile.user))
    Payment.objects.create(
        hire=hire,
        reference=f"THR-{hire.id.hex[:12]}",
        amount=hire.hire_value,
        state=PaymentState.SUCCESS,
        paid_at=timezone.now(),
    )
    return Payout.objects.create(
        hire=hire,
        supplier=profile.user,
        amount=hire.payout_amount,
        kind=PayoutKind.COMPLETION,
        state=state,
    )


def _admin() -> PayoutAdmin:
    return PayoutAdmin(Payout, AdminSite())


def test_mark_paid_records_reference_and_emails(staff_user, django_capture_on_commit_callbacks):
    payout = _payout()
    request = _request(staff_user, apply="1", reference="ZEN-REF-99")
    with django_capture_on_commit_callbacks(execute=True):
        _admin().mark_paid(request, Payout.objects.filter(pk=payout.pk))
    payout.refresh_from_db()
    assert payout.state == PayoutState.PAID
    assert payout.paid_ref == "ZEN-REF-99"
    assert payout.paid_at is not None
    assert any("payout" in m.subject.lower() for m in mail.outbox)


def test_freeze_blocks_mark_paid(staff_user, django_capture_on_commit_callbacks):
    payout = _payout(state=PayoutState.FROZEN)
    request = _request(staff_user, apply="1", reference="SHOULD-NOT-APPLY")
    with django_capture_on_commit_callbacks(execute=True):
        # The action excludes frozen payouts from the payable set, so nothing pays.
        _admin().mark_paid(request, Payout.objects.filter(pk=payout.pk))
    payout.refresh_from_db()
    assert payout.state == PayoutState.FROZEN
    assert payout.paid_ref == ""
    assert mail.outbox == []


def test_freeze_then_unfreeze(staff_user):
    payout = _payout()
    request = _request(staff_user, apply="1", reason="Investigating a report")
    _admin().freeze_selected(request, Payout.objects.filter(pk=payout.pk))
    payout.refresh_from_db()
    assert payout.state == PayoutState.FROZEN
    assert payout.frozen_reason == "Investigating a report"

    _admin().unfreeze_selected(_request(staff_user), Payout.objects.filter(pk=payout.pk))
    payout.refresh_from_db()
    assert payout.state == PayoutState.DUE
    assert payout.frozen_reason == ""


def test_bank_number_shown_in_full_only_on_payout_queue(staff_user):
    payout = _payout()
    # Payout queue: full, decrypted number.
    full = _admin().bank_details(payout)
    assert BANK_NUMBER in full

    # Supplier admin: masked, never the full number.
    profile = SupplierProfile.objects.get(user=payout.supplier)
    masked = SupplierProfileAdmin(SupplierProfile, AdminSite()).masked_bank_account_number(profile)
    assert masked == "****6789"
    assert BANK_NUMBER not in masked
