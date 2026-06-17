"""Yards API + service (Wave 2 §2.2, FSD §5.1).

Objects we introspect are created through the service (which returns a typed
``Yard``); the acting user comes from a fixture. This mirrors the accounts
tests and keeps the suite type-clean.
"""

from __future__ import annotations

import pytest
from django.contrib.gis.geos import Point
from django.urls import reverse

from suppliers.models import Yard
from suppliers.services import yards as yards_service

pytestmark = pytest.mark.django_db

LIST = "/api/v1/yards"


def _point(lng: float, lat: float) -> dict:
    return {"type": "Point", "coordinates": [lng, lat]}


def test_urls_resolve():
    assert reverse("api:suppliers:yards") == LIST


def test_create_and_list_yard(auth, supplier):
    resp = auth(supplier).post(
        LIST,
        {"name": "Apapa Yard", "point": _point(3.3792, 6.4433), "city": "Lagos"},
        format="json",
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["name"] == "Apapa Yard"
    assert body["point"]["type"] == "Point"
    assert body["point"]["coordinates"] == [3.3792, 6.4433]

    listed = auth(supplier).get(LIST).json()["results"]
    assert len(listed) == 1
    assert listed[0]["name"] == "Apapa Yard"


def test_hirer_cannot_create_yard(auth, hirer):
    resp = auth(hirer).post(LIST, {"name": "X", "point": _point(3.0, 6.0)}, format="json")
    assert resp.status_code == 403


def test_yards_are_owner_scoped(auth, supplier, supplier2):
    other = yards_service.create_yard(
        user=supplier2, name="Other Yard", point=Point(3.0, 6.0, srid=4326)
    )
    assert auth(supplier).get(LIST).json()["results"] == []
    # Cannot patch another supplier's yard.
    patch = auth(supplier).patch(f"{LIST}/{other.id}", {"name": "hijack"}, format="json")
    assert patch.status_code == 404


def test_patch_moves_point(auth, supplier):
    yard = yards_service.create_yard(
        user=supplier, name="Apapa", point=Point(3.3792, 6.4433, srid=4326)
    )
    resp = auth(supplier).patch(f"{LIST}/{yard.id}", {"point": _point(7.4, 9.1)}, format="json")
    assert resp.status_code == 200
    assert resp.json()["point"]["coordinates"] == [7.4, 9.1]
    yard.refresh_from_db()
    assert (round(yard.point.x, 4), round(yard.point.y, 4)) == (7.4, 9.1)


def test_delete_yard_without_listings(auth, supplier):
    yard = yards_service.create_yard(
        user=supplier, name="Apapa", point=Point(3.3792, 6.4433, srid=4326)
    )
    resp = auth(supplier).delete(f"{LIST}/{yard.id}")
    assert resp.status_code == 204
    assert not Yard.objects.filter(id=yard.id).exists()


def test_nearest_yard_within_radius(supplier):
    yard = yards_service.create_yard(
        user=supplier, name="Apapa", point=Point(3.3792, 6.4433, srid=4326)
    )
    # ~50m away → matched.
    near = yards_service.nearest_yard_within(user=supplier, point=Point(3.37965, 6.4433, srid=4326))
    assert near is not None and near.id == yard.id
    # ~2km away → no match.
    far = yards_service.nearest_yard_within(user=supplier, point=Point(3.40, 6.4433, srid=4326))
    assert far is None
