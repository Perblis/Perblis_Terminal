"""seed_e2e management command tests (Wave 7 slice 7-0, TSD §8)."""

from __future__ import annotations

import json
from io import StringIO

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import override_settings

pytestmark = pytest.mark.django_db


def _run() -> dict:
    out = StringIO()
    call_command("seed_e2e", stdout=out)
    return json.loads(out.getvalue())


@override_settings(DEBUG=True)
def test_seeds_full_fixture_set():
    from hires.enums import HireStatus
    from hires.models import Hire

    summary = _run()
    requested = Hire.objects.get(pk=summary["requested_hire_id"])
    confirmed = Hire.objects.get(pk=summary["confirmed_hire_id"])
    assert requested.status == HireStatus.REQUESTED
    assert confirmed.status == HireStatus.CONFIRMED
    assert confirmed.events.count() >= 3  # requested + accept + pay
    assert requested.listing.status == "live"
    assert requested.supplier.is_account_verified


@override_settings(DEBUG=True)
def test_idempotent_rerun():
    from accounts.models import User
    from hires.models import Hire

    first = _run()
    second = _run()
    assert first["listing_id"] == second["listing_id"]
    assert first["requested_hire_id"] == second["requested_hire_id"]
    assert User.objects.filter(email__endswith="e2e.terminal.test").count() == 2
    assert Hire.objects.count() == 2


@override_settings(DEBUG=False)
def test_refuses_outside_debug():
    with pytest.raises(CommandError):
        call_command("seed_e2e")
