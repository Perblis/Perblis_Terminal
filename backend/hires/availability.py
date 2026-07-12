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
from .models import AvailabilityBlock, Hire


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


def is_blocked(listing, start: dt.date, end: dt.date) -> bool:
    """True iff a supplier date-block overlaps ``[start, end]`` (D-024).

    A block is a hard hold on the whole listing — every unit is occupied for
    its range, so it zeroes both public availability and confirm capacity.
    """
    return AvailabilityBlock.objects.filter(
        listing=listing, start_date__lte=end, end_date__gte=start
    ).exists()


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
    if is_blocked(listing, start, end):
        return 0
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
    if is_blocked(listing, start, end):
        return False
    held = overlapping_holds(listing, start, end, exclude_hire_id=exclude_hire_id, now=now)
    return held < listing.unit_count


def can_confirm(
    listing,
    start: dt.date,
    end: dt.date,
    *,
    exclude_hire_id=None,
) -> bool:
    """True iff a unit is free to *take* (accept/confirm) — counts hard holds only.

    A supplier date-block is a hard hold too (D-024): accept/pay reject into a
    blocked range exactly as they would into a fully-confirmed one.
    """
    if is_blocked(listing, start, end):
        return False
    held = _count(listing, start, end, _hard_q(), exclude_hire_id)
    return held < listing.unit_count


def free_units_by_day(
    listing, start: dt.date, end: dt.date, *, now: dt.datetime | None = None
) -> dict[dt.date, int]:
    """Per-day free-unit counts over ``[start, end]`` — the hirer calendar's data.

    Two queries (soft holds + blocks) and a difference-array sweep — O(hires +
    days), never a query per day.

    Deliberately **per-day** counting, unlike the whole-range ``is_available``:
    two disjoint hires can leave every individual day free while the full range
    still fails the conservative request/accept gate. The calendar answers
    "which days are busy"; requests keep gating on the range engine. Do not
    "fix" that mismatch — it is the intended semantics.
    """
    now = now or timezone.now()
    n_days = (end - start).days + 1
    delta = [0] * (n_days + 1)
    holds = (
        Hire.objects.filter(listing=listing)
        .filter(_soft_q(now))
        .filter(start_date__lte=end, end_date__gte=start)
        .values_list("start_date", "end_date")
    )
    for h_start, h_end in holds:
        i = max((h_start - start).days, 0)
        j = min((h_end - start).days, n_days - 1)
        delta[i] += 1
        delta[j + 1] -= 1

    blocked = [False] * n_days
    blocks = AvailabilityBlock.objects.filter(
        listing=listing, start_date__lte=end, end_date__gte=start
    ).values_list("start_date", "end_date")
    for b_start, b_end in blocks:
        i = max((b_start - start).days, 0)
        j = min((b_end - start).days, n_days - 1)
        for k in range(i, j + 1):
            blocked[k] = True

    result: dict[dt.date, int] = {}
    held = 0
    for d in range(n_days):
        held += delta[d]
        day = start + dt.timedelta(days=d)
        result[day] = 0 if blocked[d] else max(listing.unit_count - held, 0)
    return result


def availability_map(listings, *, on_date: dt.date | None = None, now=None) -> dict:
    """Bulk ``{listing.id: available_now}`` for many listings in O(1) queries.

    "Available now" means a unit is free over ``on_date`` (default today) against
    *soft* holds and supplier date-blocks — what the map/list ``available`` flag
    and the yard sheet's "n of m free" caption show. Computed in one grouped
    aggregate plus one block lookup so search stays within its N+1-free budget.
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
    blocked = set(
        AvailabilityBlock.objects.filter(
            listing_id__in=ids, start_date__lte=on_date, end_date__gte=on_date
        ).values_list("listing_id", flat=True)
    )
    return {ln.id: ln.id not in blocked and held.get(ln.id, 0) < ln.unit_count for ln in listings}
