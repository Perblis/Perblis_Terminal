"""Weekly digest + reconciliation persistence (wave-6 §6.8)."""

from __future__ import annotations

from typing import cast

import pytest
from django.core import mail
from django.utils import timezone

from core import realtime
from hires.factories import HireFactory
from hires.models import Hire
from ops.models import ReconciliationRun
from ops.services.digest import build_digest, render_digest
from payments.enums import PaymentState
from payments.models import Payment

pytestmark = pytest.mark.django_db


def _paid_hire() -> Hire:
    hire = cast(Hire, HireFactory())
    Payment.objects.create(
        hire=hire,
        reference=f"THR-{hire.id.hex[:12]}",
        amount=hire.hire_value,
        state=PaymentState.SUCCESS,
        paid_at=timezone.now(),
    )
    return hire


def test_ably_usage_none_when_keyless():
    assert realtime.ably_usage() is None  # ABLY_API_KEY empty in test settings


def test_build_digest_keyless_degrades_to_na():
    _paid_hire()
    digest = build_digest()
    assert digest["ably"] is None
    assert digest["r2"] is None
    subject, body = render_digest(digest)
    assert "digest" in subject.lower()
    assert "GMV" in body
    assert "Ably: n/a" in body
    assert "R2: n/a" in body


def test_digest_includes_real_numbers():
    hire = _paid_hire()
    _, body = render_digest(build_digest())
    from core.money import display

    assert display(hire.hire_value) in body  # GMV line


def test_send_weekly_digest_emails_founder(settings):
    settings.OPS_DIGEST_RECIPIENT = "founder@example.com"
    _paid_hire()
    from ops.tasks import send_weekly_digest

    send_weekly_digest.enqueue()
    assert any("digest" in m.subject.lower() for m in mail.outbox)
    assert mail.outbox[-1].to == ["founder@example.com"]


def test_daily_reconciliation_persists_clean_run(monkeypatch):
    hire = _paid_hire()
    payment = hire.payments.first()
    monkeypatch.setattr(
        "payments.gateway.list_ledger",
        lambda: [
            {"reference": payment.reference, "amount_kobo": hire.hire_value, "succeeded": True}
        ],
    )
    from payments.tasks import daily_reconciliation

    daily_reconciliation.enqueue()
    run = ReconciliationRun.objects.latest("run_at")
    assert run.checked == 1
    assert run.mismatch_count == 0
    assert mail.outbox == []  # no alert on a clean run


def test_daily_reconciliation_alerts_on_mismatch(monkeypatch, settings):
    settings.OPS_DIGEST_RECIPIENT = "ops@example.com"
    _paid_hire()  # a local SUCCESS payment with no matching ledger row
    monkeypatch.setattr("payments.gateway.list_ledger", lambda: [])  # nothing in ledger
    from payments.tasks import daily_reconciliation

    daily_reconciliation.enqueue()
    run = ReconciliationRun.objects.latest("run_at")
    assert run.mismatch_count == 1
    assert any("reconciliation" in m.subject.lower() for m in mail.outbox)
