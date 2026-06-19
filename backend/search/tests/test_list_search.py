"""Search list endpoint — FSD §6 / TSD §3.2 (Wave 3 §3.2).

Covers both groupings (asset / location), more_at_yard sub-lines, distance
ordering, and cursor-pagination stability under inserts.
"""

from __future__ import annotations

from typing import cast

import pytest
from django.contrib.gis.geos import Point

from accounts.models import User
from listings.enums import ListingStatus
from listings.factories import ListingFactory, ListingPhotoFactory
from suppliers.factories import SupplierProfileFactory, SupplierUserFactory, YardFactory
from suppliers.models import Yard

pytestmark = pytest.mark.django_db

LIST = "/api/v1/search/list"
LAGOS_BBOX = "3.0,6.0,4.0,7.0"
APAPA = (3.3792, 6.4433)  # (lng, lat)


def _supplier(**over) -> User:
    user = cast(User, SupplierUserFactory(**over))
    SupplierProfileFactory(user=user)
    return user


def _yard(**over) -> Yard:
    return cast(Yard, YardFactory(**over))


def _live(supplier, *, yard=None, point=None, **over):
    pt = point or (yard.point if yard else Point(*APAPA, srid=4326))
    return ListingFactory(supplier=supplier, yard=yard, point=pt, status=ListingStatus.LIVE, **over)


# --- asset mode -------------------------------------------------------------


def test_asset_mode_flat_list_ordered_by_distance(api):
    supplier = _supplier()
    near = _live(supplier, point=Point(3.40, 6.45, srid=4326))
    far = _live(supplier, point=Point(3.80, 6.90, srid=4326))

    body = api.get(LIST, {"lat": 6.45, "lng": 3.40, "radius_km": 100}).json()
    assert [r["id"] for r in body["results"]] == [str(near.id), str(far.id)]
    assert body["next"] is None
    assert body["previous"] is None
    # Distance + more_at_yard present on each row.
    assert body["results"][0]["distance_km"] == 0.0
    assert all("more_at_yard" in r for r in body["results"])


def test_asset_mode_more_at_yard_counts_siblings(api):
    supplier = _supplier()
    yard = _yard(supplier=supplier, point=Point(*APAPA, srid=4326))
    _live(supplier, yard=yard)
    _live(supplier, yard=yard)
    _live(supplier, yard=yard)
    solo = _live(supplier, yard=None, point=Point(3.50, 6.50, srid=4326))

    body = api.get(LIST, {"bbox": LAGOS_BBOX}).json()
    by_id = {r["id"]: r for r in body["results"]}
    # Each of the three yard listings sees 2 siblings.
    yard_rows = [r for r in body["results"] if r["yard_id"] == str(yard.id)]
    assert len(yard_rows) == 3
    assert all(r["more_at_yard"] == 2 for r in yard_rows)
    # The yardless listing has none.
    assert by_id[str(solo.id)]["more_at_yard"] == 0


def test_asset_mode_default_when_group_by_absent(api):
    supplier = _supplier()
    _live(supplier)
    body = api.get(LIST, {"bbox": LAGOS_BBOX}).json()
    assert "more_at_yard" in body["results"][0]  # asset-shaped


def test_filters_apply_to_list(api):
    supplier = _supplier()
    cheap = _live(supplier, daily_price=5_000_000)
    _live(supplier, daily_price=20_000_000)

    body = api.get(LIST, {"bbox": LAGOS_BBOX, "price_max": 10_000_000}).json()
    assert [r["id"] for r in body["results"]] == [str(cheap.id)]


# --- location mode ----------------------------------------------------------


def test_location_mode_interleaves_yard_cards_and_solos_by_distance(api):
    supplier = _supplier()
    # A yard (2 listings) close in; a solo further out.
    near_yard = _yard(supplier=supplier, point=Point(3.40, 6.45, srid=4326))
    _live(supplier, yard=near_yard)
    _live(supplier, yard=near_yard)
    far_solo = _live(supplier, yard=None, point=Point(3.80, 6.90, srid=4326))

    body = api.get(
        LIST, {"lat": 6.45, "lng": 3.40, "radius_km": 100, "group_by": "location"}
    ).json()
    results = body["results"]
    assert results[0]["type"] == "yard"
    assert results[0]["yard_id"] == str(near_yard.id)
    assert results[0]["listing_count"] == 2
    assert len(results[0]["listings"]) == 2
    assert results[1]["type"] == "listing"
    assert results[1]["id"] == str(far_solo.id)


def test_location_mode_lone_listing_is_solo_not_a_card(api):
    supplier = _supplier()
    yard = _yard(supplier=supplier, point=Point(*APAPA, srid=4326))
    lone = _live(supplier, yard=yard)  # only one Live listing at the yard

    body = api.get(LIST, {"bbox": LAGOS_BBOX, "group_by": "location"}).json()
    assert len(body["results"]) == 1
    assert body["results"][0]["type"] == "listing"
    assert body["results"][0]["id"] == str(lone.id)


# --- cursor pagination ------------------------------------------------------


def test_cursor_pagination_walks_all_items_without_gaps(api):
    supplier = _supplier()
    # 5 listings fanned out so distances are distinct and ordered.
    for i in range(5):
        _live(supplier, point=Point(3.40 + i * 0.02, 6.45, srid=4326))

    seen: list[str] = []
    url = LIST
    params = {"lat": 6.45, "lng": 3.40, "radius_km": 100, "page_size": 2}
    for _ in range(5):  # safety bound
        body = api.get(url, params).json()
        seen.extend(r["id"] for r in body["results"])
        if not body["next"]:
            break
        url = body["next"]
        params = {}
    assert len(seen) == 5
    assert len(set(seen)) == 5  # no duplicates, no skips


def test_cursor_is_stable_under_inserts(api):
    """Inserting a far-away row after page 1 doesn't shift/duplicate page 2."""
    supplier = _supplier()
    base = [_live(supplier, point=Point(3.40 + i * 0.02, 6.45, srid=4326)) for i in range(4)]
    ordered_ids = [str(x.id) for x in base]  # already nearest-first by construction

    params = {"lat": 6.45, "lng": 3.40, "radius_km": 100, "page_size": 2}
    page1 = api.get(LIST, params).json()
    assert [r["id"] for r in page1["results"]] == ordered_ids[:2]

    # Insert a nearer listing (would sort to the very front) before paging on.
    _live(supplier, point=Point(3.401, 6.45, srid=4326))

    page2 = api.get(page1["next"]).json()
    # Page 2 still continues exactly after page 1's last item — the new nearer
    # row belongs on page 1's keyspace and does not reappear here.
    assert [r["id"] for r in page2["results"]] == ordered_ids[2:4]


def test_previous_link_returns_prior_page(api):
    supplier = _supplier()
    base = [_live(supplier, point=Point(3.40 + i * 0.02, 6.45, srid=4326)) for i in range(4)]
    ordered_ids = [str(x.id) for x in base]

    params = {"lat": 6.45, "lng": 3.40, "radius_km": 100, "page_size": 2}
    page1 = api.get(LIST, params).json()
    page2 = api.get(page1["next"]).json()
    assert page2["previous"] is not None

    back = api.get(page2["previous"]).json()
    assert [r["id"] for r in back["results"]] == ordered_ids[:2]


def test_invalid_page_size_falls_back_to_default(api):
    supplier = _supplier()
    _live(supplier)
    resp = api.get(LIST, {"bbox": LAGOS_BBOX, "page_size": "not-a-number"})
    assert resp.status_code == 200
    assert len(resp.json()["results"]) == 1


def test_page_size_capped(api):
    supplier = _supplier()
    for i in range(3):
        _live(supplier, point=Point(3.40 + i * 0.02, 6.45, srid=4326))
    body = api.get(LIST, {"bbox": LAGOS_BBOX, "page_size": 100000}).json()
    assert len(body["results"]) == 3  # capped page size still returns all 3 here


# --- shape & access ---------------------------------------------------------


def test_asset_row_shape(api):
    supplier = _supplier()
    ln = _live(supplier)
    ListingPhotoFactory(listing=ln, is_cover=True)
    row = api.get(LIST, {"bbox": LAGOS_BBOX}).json()["results"][0]
    assert set(row) >= {
        "id",
        "title",
        "asset_class",
        "point",
        "price_from",
        "price_from_display",
        "distance_km",
        "photo",
        "badge",
        "available",
        "yard_id",
        "more_at_yard",
    }


def test_anonymous_access_allowed(api):
    supplier = _supplier()
    _live(supplier)
    assert api.get(LIST, {"bbox": LAGOS_BBOX}).status_code == 200


def test_invalid_group_by_rejected(api):
    resp = api.get(LIST, {"bbox": LAGOS_BBOX, "group_by": "nonsense"})
    assert resp.status_code == 400


def test_suspended_supplier_excluded_from_list(api):
    from django.utils import timezone

    supplier = _supplier()
    _live(supplier)
    supplier.suspended_at = timezone.now()
    supplier.save(update_fields=["suspended_at"])

    body = api.get(LIST, {"bbox": LAGOS_BBOX}).json()
    assert body["results"] == []


def test_list_is_n_plus_1_free(api, django_assert_max_num_queries):
    supplier = _supplier()
    yard = _yard(supplier=supplier, point=Point(*APAPA, srid=4326))
    for _ in range(6):
        ln = _live(supplier, yard=yard)
        ListingPhotoFactory(listing=ln, is_cover=True)
    for _ in range(6):
        _live(supplier, yard=None, point=Point(3.50, 6.50, srid=4326))

    with django_assert_max_num_queries(6):
        api.get(LIST, {"bbox": LAGOS_BBOX, "group_by": "location"})
