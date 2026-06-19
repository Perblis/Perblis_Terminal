"""Availability engine (TSD §3.4, binding).

Two questions, two checks:

* **Public availability** (``is_available`` / ``free_units``) — what a new hirer
  sees on the map, date-picker, and at request time. A date range is available
  iff the *soft* holds overlapping it are below ``unit_count``. Soft holds are
  ``confirmed``, ``on_hire``, and ``accepted`` **with a live payment deadline**;
  a ``requested`` hire never holds (multiple may overlap).

* **Confirm capacity** (``can_confirm``) — whether a unit is actually free to be
  *taken*, counting only the *hard* holds (``confirmed`` / ``on_hire``). A
  supplier may accept several overlapping requests (oversell); they soft-hold,
  but **first-to-pay wins** and the others are auto-declined when one confirms
  (FSD §7.3). So ``accept`` and ``pay`` both gate on ``can_confirm``, not on the
  softer public availability.

This module is read-only; the capacity-consuming writes re-check ``can_confirm``
under a ``SELECT … FOR UPDATE`` on the listing row in ``hires.state``.
"""

from __future__ import annotations

import datetime as dt

from django.db.models import Count, Q
from django.utils import timezone

from .enums import HireStatus
from .models import Hire


def _soft_q(now: dt.datetime) -> Q:
    """Hires that hold dates against *new* demand (TSD §3.4)."""
    return Q(status__in=[HireStatus.CONFIRMED, HireStatus.ON_HIRE]) | Q(
        status=HireStatus.ACCEPTED, payment_deadline__gt=now
    )


def _hard_q() -> Q:
    """Hires that have *taken* a unit — only these block a confirmation."""
    return Q(status__in=[HireStatus.CONFIRMED, HireStatus.ON_HIRE])


def _count(listing, start: dt.date, end: dt.date, q: Q, exclude_hire_id) -> int:
    qs = (
        Hire.objects.filter(listing=listing)
        .filter(q)
        .filter(start_date__lte=end, end_date__gte=start)
    )
    if exclude_hire_id is not None:
        qs = qs.exclude(id=exclude_hire_id)
    return qs.count()


def overlapping_holds(
    listing,
    start: dt.date,
    end: dt.date,
    *,
    exclude_hire_id=None,
    now: dt.datetime | None = None,
) -> int:
    """Soft holds overlapping ``[start, end]`` (public availability)."""
    now = now or timezone.now()
    return _count(listing, start, end, _soft_q(now), exclude_hire_id)


def free_units(
    listing,
    start: dt.date,
    end: dt.date,
    *,
    exclude_hire_id=None,
    now: dt.datetime | None = None,
) -> int:
    """Units free over ``[start, end]`` — the "n of m free" caption data (ux/02 S5)."""
    held = overlapping_holds(listing, start, end, exclude_hire_id=exclude_hire_id, now=now)
    return max(listing.unit_count - held, 0)


def is_available(
    listing,
    start: dt.date,
    end: dt.date,
    *,
    exclude_hire_id=None,
    now: dt.datetime | None = None,
) -> bool:
    """True iff at least one unit is free to a *new* hirer across ``[start, end]``."""
    held = overlapping_holds(listing, start, end, exclude_hire_id=exclude_hire_id, now=now)
    return held < listing.unit_count


def can_confirm(
    listing,
    start: dt.date,
    end: dt.date,
    *,
    exclude_hire_id=None,
) -> bool:
    """True iff a unit is free to *take* (accept/confirm) — counts hard holds only."""
    held = _count(listing, start, end, _hard_q(), exclude_hire_id)
    return held < listing.unit_count


def availability_map(listings, *, on_date: dt.date | None = None, now=None) -> dict:
    """Bulk ``{listing.id: available_now}`` for many listings in **one** query.

    "Available now" means a unit is free over ``on_date`` (default today) against
    *soft* holds — what the map/list ``available`` flag and the yard sheet's
    "n of m free" caption show. Computed in a single grouped aggregate so search
    stays within its N+1-free query budget.
    """
    listings = list(listings)
    if not listings:
        return {}
    on_date = on_date or timezone.localdate()
    now = now or timezone.now()
    ids = [ln.id for ln in listings]
    rows = (
        Hire.objects.filter(listing_id__in=ids)
        .filter(_soft_q(now))
        .filter(start_date__lte=on_date, end_date__gte=on_date)
        .values("listing_id")
        .annotate(n=Count("id"))
    )
    held = {row["listing_id"]: row["n"] for row in rows}
    return {ln.id: held.get(ln.id, 0) < ln.unit_count for ln in listings}
