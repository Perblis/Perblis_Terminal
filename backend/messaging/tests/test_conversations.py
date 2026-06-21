"""Conversation create + list + access control (FSD §8 acceptance)."""

from __future__ import annotations

import pytest

from listings.enums import ListingStatus
from listings.factories import ListingFactory
from messaging.models import Conversation

pytestmark = pytest.mark.django_db

CONV = "/api/v1/conversations"


def test_create_listing_enquiry(auth, hirer):
    listing = ListingFactory(status=ListingStatus.LIVE)
    resp = auth(hirer).post(CONV, {"listing_id": str(listing.id)})
    assert resp.status_code == 201
    body = resp.json()
    assert body["kind"] == "enquiry"
    assert body["listing"]["id"] == str(listing.id)
    conv = Conversation.objects.get(id=body["id"])
    assert conv.supplier_id == listing.supplier_id
    assert conv.hirer_id == hirer.id


def test_listing_enquiry_is_idempotent(auth, hirer):
    listing = ListingFactory(status=ListingStatus.LIVE)
    first = auth(hirer).post(CONV, {"listing_id": str(listing.id)}).json()
    second = auth(hirer).post(CONV, {"listing_id": str(listing.id)}).json()
    assert first["id"] == second["id"]
    assert Conversation.objects.filter(listing=listing, hirer=hirer).count() == 1


def test_create_general_enquiry_has_no_listing(auth, hirer):
    listing = ListingFactory(status=ListingStatus.LIVE)
    supplier = listing.supplier
    resp = auth(hirer).post(CONV, {"supplier_id": str(supplier.id)})
    assert resp.status_code == 201
    assert resp.json()["listing"] is None


def test_general_enquiry_is_idempotent(auth, hirer):
    listing = ListingFactory(status=ListingStatus.LIVE)
    supplier = listing.supplier
    a = auth(hirer).post(CONV, {"supplier_id": str(supplier.id)}).json()
    b = auth(hirer).post(CONV, {"supplier_id": str(supplier.id)}).json()
    assert a["id"] == b["id"]
    assert (
        Conversation.objects.filter(supplier=supplier, hirer=hirer, listing__isnull=True).count()
        == 1
    )


def test_enquiry_requires_exactly_one_target(auth, hirer):
    listing = ListingFactory(status=ListingStatus.LIVE)
    both = auth(hirer).post(
        CONV, {"listing_id": str(listing.id), "supplier_id": str(listing.supplier_id)}
    )
    assert both.status_code == 400
    assert both.json()["error"]["code"] == "invalid_enquiry_target"
    neither = auth(hirer).post(CONV, {})
    assert neither.status_code == 400


def test_cannot_enquire_own_listing(auth):
    listing = ListingFactory(status=ListingStatus.LIVE)
    resp = auth(listing.supplier).post(CONV, {"listing_id": str(listing.id)})
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "cannot_enquire_own_listing"


def test_list_returns_callers_conversations_with_aggregate_unread(auth, hirer):
    listing = ListingFactory(status=ListingStatus.LIVE)
    auth(hirer).post(CONV, {"listing_id": str(listing.id)})
    resp = auth(hirer).get(CONV)
    assert resp.status_code == 200
    body = resp.json()
    assert "unread_total" in body
    assert len(body["results"]) == 1


def test_non_participant_gets_404_on_messages(auth, hirer):
    from accounts.factories import UserFactory

    listing = ListingFactory(status=ListingStatus.LIVE)
    conv = auth(hirer).post(CONV, {"listing_id": str(listing.id)}).json()
    stranger = UserFactory()
    resp = auth(stranger).get(f"{CONV}/{conv['id']}/messages")
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "conversation_not_found"


def test_other_supplier_cannot_read_enquiry(auth, hirer):
    listing = ListingFactory(status=ListingStatus.LIVE)
    other_listing = ListingFactory(status=ListingStatus.LIVE)  # different supplier
    conv = auth(hirer).post(CONV, {"listing_id": str(listing.id)}).json()
    resp = auth(other_listing.supplier).get(f"{CONV}/{conv['id']}/messages")
    assert resp.status_code == 404
