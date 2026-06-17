"""Publish gates + state machine + photos + duplicate (Wave 2 §2.4/§2.5)."""

from __future__ import annotations

import pytest
from django.contrib.gis.geos import Point

from accounts.factories import UserFactory
from listings.models import Listing
from listings.services import listings as listings_service
from listings.services import photos as photos_service
from listings.services.spec_seed import seed_spec_templates
from suppliers.factories import SupplierProfileFactory

pytestmark = pytest.mark.django_db

FULL_SPECS = {
    "make": "Caterpillar",
    "model": "320D",
    "year": 2020,
    "condition": "Good",
    "operator_included": "Included",
}
DESC = "A perfectly long description for a publishable excavator listing here."
_PT = Point(3.3792, 6.4433, srid=4326)


@pytest.fixture
def seeded():
    seed_spec_templates()


def _make_listing(user, *, specs=None, point=_PT, with_photo=True):
    listing, _ = listings_service.create_listing(
        user=user,
        asset_class="plant_machinery",
        asset_type="Excavator",
        title="CAT 320D",
        description=DESC,
        specs=FULL_SPECS if specs is None else specs,
        daily_price=8_000_000,
        point=point,
    )
    if with_photo:
        photos_service.attach_photo(user=user, listing_id=listing.id, r2_key="listings/a.jpg")
    return listing


def _publish(auth, user, listing):
    return auth(user).post(f"/api/v1/listings/{listing.id}/publish")


def test_publish_succeeds_when_all_gates_pass(auth, supplier, seeded):
    SupplierProfileFactory(user=supplier)
    listing = _make_listing(supplier)
    resp = _publish(auth, supplier, listing)
    assert resp.status_code == 200
    assert resp.json()["status"] == "live"
    assert resp.json()["tier"] == "basic"


def test_publish_requires_photo(auth, supplier, seeded):
    SupplierProfileFactory(user=supplier)
    listing = _make_listing(supplier, with_photo=False)
    resp = _publish(auth, supplier, listing)
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "publish_requires_photo"


def test_publish_requires_location(auth, supplier, seeded):
    SupplierProfileFactory(user=supplier)
    listing = _make_listing(supplier, point=None)
    resp = _publish(auth, supplier, listing)
    assert resp.json()["error"]["code"] == "publish_requires_location"


def test_publish_requires_specs(auth, supplier, seeded):
    SupplierProfileFactory(user=supplier)
    listing = _make_listing(supplier, specs={"make": "CAT"})  # missing model/year/...
    resp = _publish(auth, supplier, listing)
    body = resp.json()
    assert body["error"]["code"] == "publish_requires_specs"
    assert "model" in body["error"]["fields"]


def test_publish_requires_daily_price(auth, supplier, seeded):
    SupplierProfileFactory(user=supplier)
    listing = _make_listing(supplier)
    Listing.objects.filter(id=listing.id).update(daily_price=0)
    resp = _publish(auth, supplier, listing)
    assert resp.json()["error"]["code"] == "publish_requires_daily_price"


def test_publish_requires_verification(auth, seeded):
    basic = UserFactory(is_supplier=True, account_level="basic")
    SupplierProfileFactory(user=basic)
    listing = _make_listing(basic)
    resp = _publish(auth, basic, listing)
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "verification_required"


def test_publish_requires_complete_profile(auth, supplier, seeded):
    # Verified supplier, but no business profile.
    listing = _make_listing(supplier)
    resp = _publish(auth, supplier, listing)
    assert resp.json()["error"]["code"] == "business_profile_incomplete"


def test_pause_and_archive_flow(auth, supplier, seeded):
    SupplierProfileFactory(user=supplier)
    listing = _make_listing(supplier)
    _publish(auth, supplier, listing)
    paused = auth(supplier).post(f"/api/v1/listings/{listing.id}/pause")
    assert paused.json()["status"] == "paused"
    # Paused → Live again via publish.
    relive = auth(supplier).post(f"/api/v1/listings/{listing.id}/publish")
    assert relive.json()["status"] == "live"
    archived = auth(supplier).post(f"/api/v1/listings/{listing.id}/archive")
    assert archived.json()["status"] == "archived"


def test_invalid_transition_rejected(auth, supplier, seeded):
    listing = _make_listing(supplier)  # draft
    resp = auth(supplier).post(f"/api/v1/listings/{listing.id}/pause")  # can't pause a draft
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "listing_invalid_transition"


def test_photo_cap_enforced(auth, supplier, seeded):
    listing = _make_listing(supplier, with_photo=False)
    for i in range(10):
        photos_service.attach_photo(
            user=supplier, listing_id=listing.id, r2_key=f"listings/{i}.jpg"
        )
    resp = auth(supplier).post(
        f"/api/v1/listings/{listing.id}/photos", {"r2_key": "listings/x.jpg"}, format="json"
    )
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "photo_limit_exceeded"


def test_first_photo_is_cover_and_reorder(auth, supplier, seeded):
    listing = _make_listing(supplier, with_photo=False)
    p1 = (
        auth(supplier)
        .post(f"/api/v1/listings/{listing.id}/photos", {"r2_key": "listings/1.jpg"}, format="json")
        .json()
    )
    p2 = (
        auth(supplier)
        .post(f"/api/v1/listings/{listing.id}/photos", {"r2_key": "listings/2.jpg"}, format="json")
        .json()
    )
    assert p1["is_cover"] is True and p2["is_cover"] is False
    # Re-order: make p2 the cover at position 0.
    resp = auth(supplier).patch(
        f"/api/v1/listings/{listing.id}/photos/order",
        {
            "photos": [
                {"id": p2["id"], "position": 0, "is_cover": True},
                {"id": p1["id"], "position": 1},
            ]
        },
        format="json",
    )
    assert resp.status_code == 200
    by_id = {p["id"]: p for p in resp.json()}
    assert by_id[p2["id"]]["is_cover"] is True
    assert by_id[p1["id"]]["is_cover"] is False


def test_duplicate_creates_draft_basic_copy(auth, supplier, seeded):
    SupplierProfileFactory(user=supplier)
    listing = _make_listing(supplier)
    _publish(auth, supplier, listing)  # original is Live
    resp = auth(supplier).post(
        f"/api/v1/listings/{listing.id}/duplicate", {"copy_photos": True}, format="json"
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["id"] != str(listing.id)
    assert body["status"] == "draft"
    assert body["tier"] == "basic"
    assert body["specs"] == FULL_SPECS
    assert len(body["photos"]) == 1  # photo key copied (no re-upload)
