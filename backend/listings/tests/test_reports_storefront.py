"""Reports + storefronts (Wave 2 §2.6, FSD §5.2/§5.3)."""

from __future__ import annotations

import datetime as dt

import pytest
from django.contrib.gis.geos import Point
from django.utils import timezone
from freezegun import freeze_time

from accounts.factories import UserFactory
from listings.models import Listing, Report
from listings.services import listings as listings_service
from listings.services import photos as photos_service
from listings.services import reports as reports_service
from listings.services.spec_seed import seed_spec_templates
from suppliers.factories import SupplierProfileFactory

pytestmark = pytest.mark.django_db

DESC = "A perfectly long description for a publishable excavator listing here."
FULL_SPECS = {
    "make": "Caterpillar",
    "model": "320D",
    "year": 2020,
    "condition": "Good",
    "operator_included": "Included",
}


@pytest.fixture
def seeded():
    seed_spec_templates()


def _live_listing(supplier):
    SupplierProfileFactory(user=supplier)
    listing, _ = listings_service.create_listing(
        user=supplier,
        asset_class="plant_machinery",
        asset_type="Excavator",
        title="CAT 320D",
        description=DESC,
        specs=FULL_SPECS,
        daily_price=8_000_000,
        point=Point(3.3792, 6.4433, srid=4326),
    )
    photos_service.attach_photo(user=supplier, listing_id=listing.id, r2_key="listings/a.jpg")
    from listings import state

    state.apply(listing, "publish")
    return listing


def _live_listing_extra(supplier, *, title):
    """A second (third, tenth) Live listing for the same supplier — the profile
    already exists, so this skips the SupplierProfileFactory call."""
    listing, _ = listings_service.create_listing(
        user=supplier,
        asset_class="plant_machinery",
        asset_type="Excavator",
        title=title,
        description=DESC,
        specs=FULL_SPECS,
        daily_price=8_000_000,
        point=Point(3.3792, 6.4433, srid=4326),
    )
    photos_service.attach_photo(user=supplier, listing_id=listing.id, r2_key="listings/b.jpg")
    from listings import state

    state.apply(listing, "publish")
    return listing


def test_hirer_can_report_live_listing(auth, supplier, hirer, seeded):
    listing = _live_listing(supplier)
    resp = auth(hirer).post(
        f"/api/v1/listings/{listing.id}/reports",
        {"reason": "inaccurate", "note": "Photos look fake"},
        format="json",
    )
    assert resp.status_code == 201
    assert resp.json()["state"] == "open"
    assert Report.objects.filter(listing=listing).count() == 1


def test_non_hirer_cannot_report(auth, supplier, seeded):
    # Reporting requires the hirer role (IsHirer). A pure supplier (not a hirer)
    # is rejected; a user with both roles could report.
    listing = _live_listing(supplier)
    pure_supplier = UserFactory(is_supplier=True, is_hirer=False, account_level="verified")
    resp = auth(pure_supplier).post(
        f"/api/v1/listings/{listing.id}/reports", {"reason": "inaccurate"}, format="json"
    )
    assert resp.status_code == 403


def test_cannot_report_non_live_listing(auth, supplier, hirer, seeded):
    listing, _ = listings_service.create_listing(
        user=supplier,
        asset_class="plant_machinery",
        asset_type="Excavator",
        title="Draft",
        description=DESC,
        specs={},
        daily_price=8_000_000,
        point=Point(3.3792, 6.4433, srid=4326),
    )
    resp = auth(hirer).post(
        f"/api/v1/listings/{listing.id}/reports", {"reason": "inaccurate"}, format="json"
    )
    assert resp.status_code == 404


def test_report_throttle_5_per_day(auth, supplier, hirer, seeded):
    listing = _live_listing(supplier)
    url = f"/api/v1/listings/{listing.id}/reports"
    client = auth(hirer)
    for _ in range(5):
        assert client.post(url, {"reason": "inaccurate"}, format="json").status_code == 201
    sixth = client.post(url, {"reason": "inaccurate"}, format="json")
    assert sixth.status_code == 429


def test_three_reports_in_30_days_sets_priority_flag(supplier, seeded):
    listing = _live_listing(supplier)
    with freeze_time("2026-06-01"):
        for _ in range(2):
            reports_service.create_report(
                user=UserFactory(), listing_id=listing.id, reason="inaccurate"
            )
        listing.refresh_from_db()
        assert listing.priority_review_flag is False  # only 2 so far
        reports_service.create_report(
            user=UserFactory(), listing_id=listing.id, reason="fraudulent"
        )
    listing.refresh_from_db()
    assert listing.priority_review_flag is True
    assert listing.report_count == 3


def test_old_reports_outside_window_dont_trigger_flag(supplier, seeded):
    listing = _live_listing(supplier)
    with freeze_time("2026-01-01"):
        for _ in range(3):
            reports_service.create_report(
                user=UserFactory(), listing_id=listing.id, reason="inaccurate"
            )
        Listing.objects.filter(id=listing.id).update(priority_review_flag=False)
    # Months later, a single new report — the 3 old ones are outside the 30-day window.
    with freeze_time("2026-06-01"):
        reports_service.create_report(
            user=UserFactory(), listing_id=listing.id, reason="inaccurate"
        )
    listing.refresh_from_db()
    assert listing.priority_review_flag is False


def test_storefront_public_shape(api, supplier, seeded):
    listing = _live_listing(supplier)
    resp = api.get(f"/api/v1/storefronts/{supplier.id}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["supplier_id"] == str(supplier.id)
    assert body["business_name"]
    assert body["verification_badge"] == "verified"
    assert len(body["live_listings"]) == 1
    assert body["live_listings"][0]["id"] == str(listing.id)
    assert body["live_listings"][0]["daily_price_display"] == "₦80,000"
    # Additive since D-030: a storefront card answers "suitable? trustworthy?
    # can I have it?" without the hirer opening every asset. `specs` is the
    # same dict GET /listings/{id} already serves anonymously.
    row = body["live_listings"][0]
    assert row["specs"] == FULL_SPECS
    assert row["tier"] == "basic"
    assert row["available"] is True
    # No fee fields leak (D-014).
    assert "service_fee" not in resp.text and "payout" not in resp.text


def test_storefront_available_flips_under_a_live_hold(api, supplier, hirer, seeded):
    """`available` is the same soft-hold question the map and list rows ask."""
    from hires import state as hire_state
    from hires.services import create_hire

    listing = _live_listing(supplier)
    free = _live_listing_extra(supplier, title="Second Machine")

    today = timezone.localdate()
    hire = create_hire(
        user=hirer,
        listing_id=listing.id,
        start_date=today,
        end_date=today + dt.timedelta(days=2),
    )
    hire_state.apply(hire, "accept", actor=supplier)

    rows = {
        r["id"]: r for r in api.get(f"/api/v1/storefronts/{supplier.id}").json()["live_listings"]
    }
    assert rows[str(listing.id)]["available"] is False
    assert rows[str(free.id)]["available"] is True


def test_storefront_listings_are_ordered_by_id_not_heap_order(api, supplier, seeded):
    """Without an ORDER BY, Postgres returns heap order — which changes after
    any UPDATE, so the same storefront could list its assets differently on two
    consecutive reads. ids are UUIDv7, so id order is creation order."""
    first = _live_listing(supplier)
    second = _live_listing_extra(supplier, title="Second Machine")
    third = _live_listing_extra(supplier, title="Third Machine")

    # Touch the middle row: under heap order this is exactly what reshuffles it.
    Listing.objects.filter(id=second.id).update(title="Second Machine (touched)")

    body = api.get(f"/api/v1/storefronts/{supplier.id}").json()
    assert [r["id"] for r in body["live_listings"]] == [
        str(first.id),
        str(second.id),
        str(third.id),
    ]


def test_storefront_query_count_does_not_scale_with_listings(
    api, supplier, seeded, django_assert_max_num_queries
):
    """Availability is one grouped aggregate for the whole storefront, so this
    endpoint must cost the same for ten assets as for one."""
    _live_listing(supplier)
    for i in range(9):
        _live_listing_extra(supplier, title=f"Machine {i}")

    with django_assert_max_num_queries(12):
        assert len(api.get(f"/api/v1/storefronts/{supplier.id}").json()["live_listings"]) == 10


def test_storefront_404_for_suspended_supplier(api, supplier, seeded):
    _live_listing(supplier)
    supplier.suspended_at = timezone.now()
    supplier.save(update_fields=["suspended_at"])
    assert api.get(f"/api/v1/storefronts/{supplier.id}").status_code == 404


def test_suspended_supplier_listings_hidden(api, supplier, seeded):
    listing = _live_listing(supplier)
    assert api.get(f"/api/v1/listings/{listing.id}").status_code == 200
    supplier.suspended_at = timezone.now()
    supplier.save(update_fields=["suspended_at"])
    assert api.get(f"/api/v1/listings/{listing.id}").status_code == 404
