"""Notification matrix tests (FSD §9) — delivery + the D-014 boundary.

Emails land in Django's locmem outbox under the test settings. The load-bearing
assertion is D-014: no hirer-facing email may name the service fee or payout.
"""

from __future__ import annotations

import datetime as dt
from typing import cast

import pytest
from django.core import mail
from django.utils import timezone

from hires import notifications, tasks
from hires.enums import HireStatus
from hires.factories import HireFactory
from hires.models import Hire
from listings.enums import ListingStatus
from listings.factories import ListingFactory

pytestmark = pytest.mark.django_db


def _hire(**kw) -> Hire:
    listing = ListingFactory(status=ListingStatus.LIVE, unit_count=1, daily_price=8_000_000)
    return cast(Hire, HireFactory(listing=listing, **kw))


def _to(addr: str) -> list:
    return [m for m in mail.outbox if addr in m.to]


def test_accepted_email_to_hirer_hides_fee():
    hire = _hire(accepted=True)
    notifications.dispatch(hire, to_status=str(HireStatus.ACCEPTED))
    msgs = _to(hire.hirer.email)
    assert msgs and "₦" in msgs[0].body
    # D-014: the fee and payout figures never appear to the hirer.
    fee_naira = f"{hire.service_fee // 100:,}"
    payout_naira = f"{hire.payout_amount // 100:,}"
    assert fee_naira not in msgs[0].body
    assert payout_naira not in msgs[0].body


def test_confirmed_receipt_hirer_no_fee_supplier_full_breakdown():
    hire = _hire(confirmed=True)
    notifications.dispatch(hire, to_status=str(HireStatus.CONFIRMED))
    hirer_body = _to(hire.hirer.email)[0].body
    supplier_body = _to(hire.supplier.email)[0].body
    fee_naira = f"{hire.service_fee // 100:,}"
    # Hirer receipt: total only.
    assert fee_naira not in hirer_body
    # Supplier: the breakdown is allowed and present.
    assert fee_naira in supplier_body


def test_completed_emails_both_parties():
    hire = _hire(on_hire=True)
    notifications.dispatch(hire, to_status=str(HireStatus.COMPLETED))
    assert _to(hire.hirer.email) and _to(hire.supplier.email)


def test_supplier_pref_suppresses_request_email():
    from suppliers.factories import SupplierProfileFactory

    hire = _hire()
    SupplierProfileFactory(user=hire.supplier, notif_hire_requests=False)
    notifications.dispatch(hire, to_status=str(HireStatus.REQUESTED))
    assert _to(hire.supplier.email) == []


# --- reminders --------------------------------------------------------------
def test_supplier_nudge_fires_in_window():
    now = timezone.now()
    # request_expires_at ~4h out → ~20h into a 24h request → inside the nudge window.
    _hire(request_expires_at=now + dt.timedelta(hours=4) - dt.timedelta(minutes=2))
    result = tasks.send_due_reminders(now=now)
    assert result["nudged"] == 1


def test_payment_warning_fires_in_window():
    now = timezone.now()
    _hire(accepted=True, payment_deadline=now + dt.timedelta(minutes=58))
    result = tasks.send_due_reminders(now=now)
    assert result["payment_warned"] == 1


def test_reminders_skip_outside_window():
    now = timezone.now()
    _hire(request_expires_at=now + dt.timedelta(hours=10))  # far from expiry
    _hire(accepted=True, payment_deadline=now + dt.timedelta(hours=3))
    assert tasks.send_due_reminders(now=now) == {"nudged": 0, "payment_warned": 0}
