"""Map search & yard aggregation — FSD §6 acceptance checks (Wave 3 §3.1).

Each named test maps to a wave-3 mandatory acceptance check.
"""

from __future__ import annotations

from typing import cast

import pytest
from django.contrib.gis.db.models.functions import Distance
from django.contrib.gis.geos import Point

from accounts.models import User
from listings.enums import AssetClass, ListingStatus, ListingTier
from listings.factories import ListingFactory, ListingPhotoFactory
from listings.models import Listing
from suppliers.factories import SupplierProfileFactory, SupplierUserFactory, YardFactory
from suppliers.models import Yard

pytestmark = pytest.mark.django_db

MAP = "/api/v1/search/map"
# A bbox covering greater Lagos (min_lng, min_lat, max_lng, max_lat).
LAGOS_BBOX = "3.0,6.0,4.0,7.0"
APAPA = (3.3792, 6.4433)  # (lng, lat)


# Factories return their factory type to the type-checker, not the model, so
# these thin helpers re-assert the model type (lets tests read `.id` etc.).
def _supplier(**over) -> User:
    user = cast(User, SupplierUserFactory(**over))
    SupplierProfileFactory(user=user)
    return user


def _yard(**over) -> Yard:
    return cast(Yard, YardFactory(**over))


def _live(supplier, *, yard=None, point=None, **over) -> Listing:
    pt = point or (yard.point if yard else Point(*APAPA, srid=4326))
    return cast(
        Listing,
        ListingFactory(supplier=supplier, yard=yard, point=pt, status=ListingStatus.LIVE, **over),
    )


# --- Grouping: yard vs. solo ------------------------------------------------


def test_same_supplier_same_coordinates_one_yard_pin(api):
    """Two Live listings at one yard ⇒ exactly one yard pin (every bbox)."""
    supplier = _supplier()
    yard = _yard(supplier=supplier, point=Point(*APAPA, srid=4326))
    _live(supplier, yard=yard)
    _live(supplier, yard=yard)

    body = api.get(MAP, {"bbox": LAGOS_BBOX}).json()
    assert len(body["yards"]) == 1
    assert body["listings"] == []
    yard_out = body["yards"][0]
    assert yard_out["yard_id"] == str(yard.id)
    assert yard_out["listing_count"] == 2
    assert yard_out["matching_count"] == 2
    assert len(yard_out["listings"]) == 2


def test_two_suppliers_one_coordinate_never_merged(api):
    """Two suppliers at the same point ⇒ two yard entries, never merged."""
    point = Point(*APAPA, srid=4326)
    seen = set()
    for _ in range(2):
        supplier = _supplier()
        yard = _yard(supplier=supplier, point=point)
        _live(supplier, yard=yard)
        _live(supplier, yard=yard)
        seen.add(str(yard.id))

    body = api.get(MAP, {"bbox": LAGOS_BBOX}).json()
    assert len(body["yards"]) == 2
    assert {y["yard_id"] for y in body["yards"]} == seen


def test_solo_listing_promotes_to_yard_on_second(api):
    """Solo ⇒ listings[]; a 2nd Live listing at the yard moves both into yards[]."""
    supplier = _supplier()
    yard = _yard(supplier=supplier, point=Point(*APAPA, srid=4326))
    _live(supplier, yard=yard)

    body = api.get(MAP, {"bbox": LAGOS_BBOX}).json()
    assert body["yards"] == []
    assert len(body["listings"]) == 1

    _live(supplier, yard=yard)
    body = api.get(MAP, {"bbox": LAGOS_BBOX}).json()
    assert len(body["yards"]) == 1
    assert body["listings"] == []
    assert body["yards"][0]["listing_count"] == 2


def test_yardless_listing_is_solo(api):
    supplier = _supplier()
    listing = _live(supplier, yard=None)

    body = api.get(MAP, {"bbox": LAGOS_BBOX}).json()
    assert body["yards"] == []
    assert [s["id"] for s in body["listings"]] == [str(listing.id)]


# --- Filters ----------------------------------------------------------------


def test_filtered_matching_count_and_zero_match_yard_present(api):
    """matching_count is filter-aware; a zero-match yard stays with count 0."""
    supplier = _supplier()
    yard = _yard(supplier=supplier, point=Point(*APAPA, srid=4326))
    _live(supplier, yard=yard, asset_class=AssetClass.PLANT_MACHINERY, asset_type="Excavator")
    _live(supplier, yard=yard, asset_class=AssetClass.TRUCKS_HAULAGE, asset_type="Flatbed Truck")

    body = api.get(MAP, {"bbox": LAGOS_BBOX, "asset_class": "plant_machinery"}).json()
    yard_out = body["yards"][0]
    assert yard_out["listing_count"] == 2
    assert yard_out["matching_count"] == 1

    # A filter that nothing at the yard matches: still present, dimmable.
    body = api.get(MAP, {"bbox": LAGOS_BBOX, "asset_class": "land_staging"}).json()
    assert len(body["yards"]) == 1
    assert body["yards"][0]["matching_count"] == 0


def test_pause_removes_listing_and_decrements_count(api):
    supplier = _supplier()
    yard = _yard(supplier=supplier, point=Point(*APAPA, srid=4326))
    _live(supplier, yard=yard)
    _live(supplier, yard=yard)
    paused = _live(supplier, yard=yard)

    body = api.get(MAP, {"bbox": LAGOS_BBOX}).json()
    assert body["yards"][0]["listing_count"] == 3

    Listing.objects.filter(id=paused.id).update(status=ListingStatus.PAUSED)
    body = api.get(MAP, {"bbox": LAGOS_BBOX}).json()
    assert body["yards"][0]["listing_count"] == 2
    embedded = {ln["id"] for ln in body["yards"][0]["listings"]}
    assert str(paused.id) not in embedded


def test_suspended_supplier_excluded(api):
    """Suspended-supplier listings vanish from search (FSD §5.3 holds through)."""
    supplier = _supplier()
    yard = _yard(supplier=supplier, point=Point(*APAPA, srid=4326))
    _live(supplier, yard=yard)
    _live(supplier, yard=yard)

    from django.utils import timezone

    supplier.suspended_at = timezone.now()
    supplier.save(update_fields=["suspended_at"])

    body = api.get(MAP, {"bbox": LAGOS_BBOX}).json()
    assert body["yards"] == []
    assert body["listings"] == []


@pytest.mark.parametrize(
    ("asset_class", "asset_type", "star"),
    [
        (AssetClass.PLANT_MACHINERY, "Excavator", "operating_weight"),
        (AssetClass.TRUCKS_HAULAGE, "Flatbed Truck", "payload_capacity"),
        (AssetClass.WAREHOUSING, "Dry Warehouse", "floor_area"),
        (AssetClass.TERMINALS_YARDS, "ICD", "container_capacity"),
        (AssetClass.LAND_STAGING, "Laydown", "area"),
    ],
)
def test_star_spec_range_filter_per_class(api, asset_class, asset_type, star):
    supplier = _supplier()
    low = _live(supplier, asset_class=asset_class, asset_type=asset_type, specs={star: 10})
    high = _live(supplier, asset_class=asset_class, asset_type=asset_type, specs={star: 50})

    # spec_min boundary (inclusive): only the high one.
    body = api.get(
        MAP, {"bbox": LAGOS_BBOX, "asset_class": str(asset_class), "spec_min": 50}
    ).json()
    assert {s["id"] for s in body["listings"]} == {str(high.id)}

    # spec_max boundary (inclusive): only the low one.
    body = api.get(
        MAP, {"bbox": LAGOS_BBOX, "asset_class": str(asset_class), "spec_max": 10}
    ).json()
    assert {s["id"] for s in body["listings"]} == {str(low.id)}


def test_spec_filter_excludes_listing_missing_the_star_value(api):
    """A listing without a numeric ★ spec is excluded under a spec range filter."""
    supplier = _supplier()
    with_value = _live(
        supplier,
        asset_class=AssetClass.PLANT_MACHINERY,
        asset_type="Excavator",
        specs={"operating_weight": 30},
    )
    _live(
        supplier, asset_class=AssetClass.PLANT_MACHINERY, asset_type="Excavator", specs={}
    )  # no operating_weight

    body = api.get(
        MAP, {"bbox": LAGOS_BBOX, "asset_class": "plant_machinery", "spec_min": 10}
    ).json()
    assert {s["id"] for s in body["listings"]} == {str(with_value.id)}


def test_price_filter_on_daily_price(api):
    supplier = _supplier()
    cheap = _live(supplier, daily_price=5_000_000)  # ₦50k
    pricey = _live(supplier, daily_price=20_000_000)  # ₦200k

    body = api.get(MAP, {"bbox": LAGOS_BBOX, "price_max": 10_000_000}).json()
    assert {s["id"] for s in body["listings"]} == {str(cheap.id)}

    body = api.get(MAP, {"bbox": LAGOS_BBOX, "price_min": 10_000_000}).json()
    assert {s["id"] for s in body["listings"]} == {str(pricey.id)}


def test_q_matches_title_and_description_case_insensitive(api):
    supplier = _supplier()
    by_title = _live(supplier, title="Yellow CAT excavator", description="A " * 30)
    by_desc = _live(supplier, title="Generic machine", description="A spare KOMATSU unit. " * 3)
    _live(supplier, title="Nothing relevant", description="Plain text. " * 5)

    body = api.get(MAP, {"bbox": LAGOS_BBOX, "q": "cat"}).json()
    assert {s["id"] for s in body["listings"]} == {str(by_title.id)}

    body = api.get(MAP, {"bbox": LAGOS_BBOX, "q": "komatsu"}).json()
    assert {s["id"] for s in body["listings"]} == {str(by_desc.id)}


# --- Geo correctness --------------------------------------------------------


def test_distance_matches_postgis_and_ordering_stable(api):
    supplier = _supplier()
    near = _live(supplier, point=Point(3.40, 6.45, srid=4326))
    far = _live(supplier, point=Point(3.80, 6.90, srid=4326))

    ref = Point(3.40, 6.45, srid=4326)
    body = api.get(MAP, {"lat": 6.45, "lng": 3.40, "radius_km": 100}).json()
    ids = [s["id"] for s in body["listings"]]
    assert ids == [str(near.id), str(far.id)]  # nearest first

    # Each distance_km matches a PostGIS reference calc to 0.1 km.
    for solo in body["listings"]:
        expected = Listing.objects.annotate(d=Distance("point", ref)).get(id=solo["id"]).d.km
        assert solo["distance_km"] == pytest.approx(round(expected, 1), abs=0.05)


def test_bbox_and_radius_parity_on_identical_data(api):
    supplier = _supplier()
    _live(supplier, point=Point(*APAPA, srid=4326))

    by_bbox = api.get(MAP, {"bbox": LAGOS_BBOX}).json()
    by_radius = api.get(MAP, {"lat": APAPA[1], "lng": APAPA[0], "radius_km": 50}).json()
    assert {s["id"] for s in by_bbox["listings"]} == {s["id"] for s in by_radius["listings"]}


def test_listing_outside_viewport_excluded(api):
    supplier = _supplier()
    _live(supplier, point=Point(7.50, 9.05, srid=4326))  # Abuja, outside Lagos bbox

    body = api.get(MAP, {"bbox": LAGOS_BBOX}).json()
    assert body["yards"] == []
    assert body["listings"] == []


# --- Response shape & access ------------------------------------------------


def test_solo_pin_shape_and_badge(api):
    supplier = _supplier()
    listing = _live(supplier, tier=ListingTier.VERIFIED)
    ListingPhotoFactory(listing=listing, is_cover=True)

    solo = api.get(MAP, {"bbox": LAGOS_BBOX}).json()["listings"][0]
    assert set(solo) == {
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
    }
    assert solo["badge"] == "verified"
    assert solo["point"]["type"] == "Point"
    assert solo["price_from_display"].startswith("₦")
    assert solo["available"] is True


def test_yard_pin_carries_supplier_badge_and_summaries(api):
    supplier = _supplier(account_level="business_verified")
    yard = _yard(supplier=supplier, point=Point(*APAPA, srid=4326))
    _live(supplier, yard=yard, daily_price=9_000_000)
    _live(supplier, yard=yard, daily_price=4_000_000)

    yard_out = api.get(MAP, {"bbox": LAGOS_BBOX}).json()["yards"][0]
    assert yard_out["supplier"]["badge"] == "business_verified"
    assert yard_out["supplier"]["name"]  # profile business name present
    assert yard_out["price_from"] == 4_000_000  # cheapest at the yard
    assert yard_out["price_from_display"] == "₦40,000"


def test_anonymous_access_allowed(api):
    supplier = _supplier()
    _live(supplier)
    resp = api.get(MAP, {"bbox": LAGOS_BBOX})
    assert resp.status_code == 200


def test_missing_area_params_rejected(api):
    resp = api.get(MAP, {"asset_class": "plant_machinery"})
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "validation_error"


def test_spec_filter_without_class_rejected(api):
    resp = api.get(MAP, {"bbox": LAGOS_BBOX, "spec_min": 10})
    assert resp.status_code == 400


def test_both_bbox_and_radius_rejected(api):
    resp = api.get(MAP, {"bbox": LAGOS_BBOX, "lat": 6.4, "lng": 3.4, "radius_km": 10})
    assert resp.status_code == 400


@pytest.mark.parametrize(
    "bad_bbox",
    [
        "3.0,6.0,4.0",  # too few values
        "a,b,c,d",  # non-numeric
        "4.0,6.0,3.0,7.0",  # min_lng >= max_lng
        "3.0,7.0,4.0,6.0",  # min_lat >= max_lat
    ],
)
def test_malformed_bbox_rejected(api, bad_bbox):
    resp = api.get(MAP, {"bbox": bad_bbox})
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "validation_error"


def test_map_is_n_plus_1_free(api, django_assert_max_num_queries):
    """A crowded viewport stays a small, constant number of queries."""
    supplier = _supplier()
    yard = _yard(supplier=supplier, point=Point(*APAPA, srid=4326))
    for _ in range(6):
        ln = _live(supplier, yard=yard)
        ListingPhotoFactory(listing=ln, is_cover=True)
    for _ in range(6):
        _live(supplier, yard=None)

    with django_assert_max_num_queries(6):
        api.get(MAP, {"bbox": LAGOS_BBOX})
