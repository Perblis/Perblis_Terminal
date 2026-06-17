"""Yard service — all yard mutation lives here (FSD §5.1).

A yard with listings cannot be deleted: the listing→yard FK is ``PROTECT``, so
``yard.delete()`` raises ``ProtectedError`` which we surface as the stable
``yard_has_listings`` code.
"""

from __future__ import annotations

from django.contrib.gis.db.models.functions import Distance
from django.contrib.gis.geos import Point
from django.contrib.gis.measure import D
from django.db import transaction
from django.db.models import ProtectedError, QuerySet
from django.shortcuts import get_object_or_404

from accounts.models import User
from suppliers.errors import YardHasListings
from suppliers.models import Yard

_WRITABLE = ("name", "point", "address_text", "city")

# Auto-yard inference radius (FSD §5.1): a new pin within 100m of an existing
# yard prompts "Add to {yard}?".
INFERENCE_RADIUS_M = 100


def list_yards(user: User) -> QuerySet[Yard]:
    return Yard.objects.filter(supplier=user)


def get_yard(*, user: User, yard_id) -> Yard:
    return get_object_or_404(Yard, id=yard_id, supplier=user)


@transaction.atomic
def create_yard(
    *, user: User, name: str, point: Point, address_text: str = "", city: str = ""
) -> Yard:
    return Yard.objects.create(
        supplier=user, name=name, point=point, address_text=address_text, city=city
    )


@transaction.atomic
def update_yard(*, user: User, yard_id, **fields) -> Yard:
    yard = get_object_or_404(Yard.objects.select_for_update(), id=yard_id, supplier=user)
    for name in _WRITABLE:
        if name in fields:
            setattr(yard, name, fields[name])
    yard.save()
    return yard


@transaction.atomic
def delete_yard(*, user: User, yard_id) -> None:
    yard = get_object_or_404(Yard, id=yard_id, supplier=user)
    try:
        yard.delete()
    except ProtectedError as exc:
        raise YardHasListings() from exc


def nearest_yard_within(
    *, user: User, point: Point, meters: int = INFERENCE_RADIUS_M
) -> Yard | None:
    """The supplier's closest yard within ``meters`` of ``point`` (or None).

    Drives the "Add to {yard}?" prompt when a listing is pinned near an
    existing yard (FSD §5.1).
    """
    return (
        Yard.objects.filter(supplier=user, point__distance_lte=(point, D(m=meters)))
        .annotate(distance=Distance("point", point))
        .order_by("distance")
        .first()
    )
