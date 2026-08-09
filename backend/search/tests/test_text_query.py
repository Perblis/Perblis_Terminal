"""Free-text ``q`` matching (FSD §6).

The old matcher was a contiguous-substring test, so a hirer typing words in
their own order got zero results. Each test here is one of the query shapes
that used to fail, phrased against catalogue text lifted from the demo market
(``core/seed/market_data.py``) so the fixtures read like the real thing.
"""

from __future__ import annotations

from typing import cast

import pytest
from django.contrib.gis.geos import Point

from accounts.models import User
from listings.enums import ListingStatus
from listings.factories import ListingFactory
from listings.models import Listing
from search.services import text
from suppliers.factories import SupplierProfileFactory, SupplierUserFactory, YardFactory
from suppliers.models import Yard

MAP = "/api/v1/search/map"
LIST = "/api/v1/search/list"
LAGOS_BBOX = "3.0,6.0,4.0,7.0"
APAPA = (3.3792, 6.4433)


# --- Pure normalisation (no DB) ---------------------------------------------


def test_punctuation_separates_words():
    assert text.normalize("Komatsu PC200-8") == "komatsu pc200 8"
    assert text.normalize("Frozen Store −18°C") == "frozen store 18 c"
    assert text.normalize("Apapa — 24/7 gate") == "apapa 24 7 gate"


def test_number_and_unit_collapse_to_one_token():
    """'30-tonne', '30 tonnes' and '30t' are the same thing to a hirer."""
    assert text.query_tokens("30-tonne tipper") == ("30t", "tipper")
    assert text.query_tokens("30 tonnes tipper") == ("30t", "tipper")
    assert text.query_tokens("30t tipper") == ("30t", "tipper")
    assert text.normalize("33,000-litre PMS/AGO Tanker") == "33000l pms ago tanker"
    assert text.normalize("6,000 sqm laydown") == "6000sqm laydown"


def test_query_tokens_on_empty_and_punctuation_only_input():
    assert text.query_tokens("") == ()
    assert text.query_tokens("—  ·") == ()


# --- Matching against real listings ----------------------------------------

pytestmark = pytest.mark.django_db


def _supplier(business_name="Harbourline Plant Ltd") -> User:
    user = cast(User, SupplierUserFactory())
    SupplierProfileFactory(user=user, business_name=business_name)
    return user


def _yard(supplier, **over) -> Yard:
    return cast(Yard, YardFactory(supplier=supplier, point=Point(*APAPA, srid=4326), **over))


def _live(supplier, **over) -> Listing:
    over.setdefault("point", Point(*APAPA, srid=4326))
    return cast(Listing, ListingFactory(supplier=supplier, status=ListingStatus.LIVE, **over))


def _hits(api, q: str) -> set[str]:
    body = api.get(MAP, {"bbox": LAGOS_BBOX, "q": q}).json()
    return {s["id"] for s in body["listings"]}


def test_terms_match_in_any_order(api):
    """'excavator 22t' reaches 'Caterpillar 320D Excavator — 22t'."""
    supplier = _supplier()
    cat = _live(supplier, title="Caterpillar 320D Excavator — 22t, operator included")
    _live(supplier, title="Howo 30-tonne Tipper", asset_type="Tipper")

    assert _hits(api, "excavator 22t") == {str(cat.id)}
    assert _hits(api, "22t excavator") == {str(cat.id)}


def test_hyphen_is_a_separator_not_a_character(api):
    """'30 tonne tipper' reaches 'Howo 30-tonne Tipper'."""
    supplier = _supplier()
    tipper = _live(supplier, title="Howo 30-tonne Tipper — sand, granite and spoil")

    assert _hits(api, "30 tonne tipper") == {str(tipper.id)}
    assert _hits(api, "30-tonne") == {str(tipper.id)}


def test_terms_prefix_match(api):
    """'cat' reaches 'Caterpillar' — hirers type the short name."""
    supplier = _supplier()
    cat = _live(supplier, title="Caterpillar 320D Excavator", specs={"make": "Caterpillar"})
    _live(supplier, title="Komatsu PC200-8 Excavator", specs={"make": "Komatsu"})

    assert _hits(api, "cat excavator") == {str(cat.id)}


def test_make_and_model_are_searchable_from_specs(api):
    """Make/model live in ``specs`` and often never appear in the title."""
    supplier = _supplier()
    pc200 = _live(
        supplier,
        title="Long-reach tracked excavator",
        specs={"make": "Komatsu", "model": "PC200-8"},
    )
    _live(supplier, title="Wheel loader", specs={"make": "SDLG", "model": "LG958L"})

    assert _hits(api, "komatsu") == {str(pc200.id)}
    assert _hits(api, "pc200") == {str(pc200.id)}


def test_plural_reaches_singular(api):
    supplier = _supplier()
    dozer = _live(supplier, title="Komatsu D65 Bulldozer", asset_type="Bulldozer")

    assert _hits(api, "bulldozers") == {str(dozer.id)}


def test_yard_and_supplier_name_are_searchable(api):
    supplier = _supplier(business_name="Harbourline Plant Ltd")
    other = _supplier(business_name="Northgate Haulage Ltd")
    apapa_yard = _yard(supplier, name="Apapa Wharf Yard", city="Lagos")
    # Two listings per yard keeps them off the solo-pin path; assert on the
    # aggregated yard pin instead.
    at_apapa = [_live(supplier, yard=apapa_yard) for _ in range(2)]
    kano_yard = _yard(other, name="Bompai Depot", city="Kano")
    for _ in range(2):
        _live(other, yard=kano_yard)

    body = api.get(MAP, {"bbox": LAGOS_BBOX, "q": "apapa"}).json()
    by_id = {y["yard_id"]: y for y in body["yards"]}
    assert by_id[str(apapa_yard.id)]["matching_count"] == len(at_apapa)
    assert by_id[str(kano_yard.id)]["matching_count"] == 0

    body = api.get(MAP, {"bbox": LAGOS_BBOX, "q": "harbourline"}).json()
    by_id = {y["yard_id"]: y for y in body["yards"]}
    assert by_id[str(apapa_yard.id)]["matching_count"] == 2
    assert by_id[str(kano_yard.id)]["matching_count"] == 0


def test_every_term_must_match(api):
    """AND, not OR — an extra term narrows, it never widens."""
    supplier = _supplier()
    _live(supplier, title="Caterpillar 320D Excavator — 22t")

    assert _hits(api, "excavator") != set()
    assert _hits(api, "excavator submarine") == set()


def test_punctuation_only_query_is_not_a_filter(api):
    supplier = _supplier()
    listing = _live(supplier, title="Caterpillar 320D Excavator")

    assert _hits(api, "—  ·") == {str(listing.id)}


def test_list_endpoint_uses_the_same_matcher(api):
    """Map and list must never disagree on what matches."""
    supplier = _supplier()
    cat = _live(supplier, title="Caterpillar 320D Excavator — 22t")
    _live(supplier, title="Howo 30-tonne Tipper", asset_type="Tipper")

    body = api.get(
        LIST, {"lat": APAPA[1], "lng": APAPA[0], "radius_km": 25, "q": "excavator 22t"}
    ).json()
    assert [r["id"] for r in body["results"]] == [str(cat.id)]
