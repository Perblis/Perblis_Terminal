"""The binding double-payment race (TSD §3.4, wave-4 §4B mandatory test).

Two payments land concurrently on the last unit. The ``SELECT … FOR UPDATE`` on
the listing row in ``state.apply`` must serialise them so **exactly one** hire
reaches Confirmed; the loser fails the re-check (flagged for auto-refund in 4D).
"""

from __future__ import annotations

import datetime as dt
import threading
from typing import cast

import pytest
from django.db import connection, transaction

from hires import errors, state
from hires.enums import ActorKind, HireStatus
from hires.factories import HireFactory
from hires.models import Hire
from listings.enums import ListingStatus
from listings.factories import ListingFactory

START = dt.date(2026, 10, 1)
END = dt.date(2026, 10, 7)


def _hire(**kw) -> Hire:
    return cast(Hire, HireFactory(**kw))


@pytest.mark.django_db(transaction=True)
def test_concurrent_payments_on_last_unit_confirm_exactly_one():
    listing = ListingFactory(status=ListingStatus.LIVE, unit_count=1, daily_price=8_000_000)
    # Two hires both Accepted on the single unit — the state a tight accept race
    # can leave behind; both now attempt to pay at once.
    a = _hire(listing=listing, start_date=START, end_date=END, accepted=True)
    b = _hire(listing=listing, start_date=START, end_date=END, accepted=True)

    results: dict = {}
    barrier = threading.Barrier(2)

    def pay(hire_id):
        barrier.wait()  # maximise contention
        try:
            with transaction.atomic():
                hire = Hire.objects.get(pk=hire_id)
                state.apply(hire, "pay", actor_kind=str(ActorKind.SYSTEM))
            results[hire_id] = "confirmed"
        except (errors.AvailabilityConflict, errors.InvalidTransition):
            # The loser either fails the capacity re-check or finds itself
            # already auto-declined by the winner's transaction — both mean lost.
            results[hire_id] = "lost"
        finally:
            connection.close()

    threads = [threading.Thread(target=pay, args=(h.id,)) for h in (a, b)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert sorted(results.values()) == ["confirmed", "lost"]
    assert Hire.objects.filter(status=HireStatus.CONFIRMED).count() == 1
