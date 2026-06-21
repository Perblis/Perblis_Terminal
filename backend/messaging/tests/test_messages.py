"""Messages: masking serve rule + unread counters (FSD §8 acceptance)."""

from __future__ import annotations

import pytest

from hires import state
from hires.enums import ActorKind
from hires.factories import HireFactory
from listings.enums import ListingStatus
from listings.factories import ListingFactory
from messaging.models import Message
from messaging.services import ensure_hire_conversation, send_message

pytestmark = pytest.mark.django_db

CONV = "/api/v1/conversations"
READ = "/api/v1/messages/read"
PHONE = "08031234567"


def _enquiry(auth, hirer, listing):
    return auth(hirer).post(CONV, {"listing_id": str(listing.id)}).json()


def _confirm(hire):
    state.apply(hire, "pay", actor_kind=str(ActorKind.SYSTEM))


def test_send_masks_contact_at_write_and_serves_masked(auth, hirer):
    listing = ListingFactory(status=ListingStatus.LIVE)
    conv = _enquiry(auth, hirer, listing)
    resp = auth(hirer).post(f"{CONV}/{conv['id']}/messages", {"body": f"call me {PHONE}"})
    assert resp.status_code == 201
    msg = Message.objects.get(id=resp.json()["id"])
    assert msg.body == f"call me {PHONE}"  # original retained for Ops
    assert PHONE not in msg.body_masked  # redacted copy
    assert PHONE not in resp.json()["body"]  # served masked
    assert resp.json()["masked"] is True


def test_enquiry_masked_forever_even_after_unrelated_hire_confirms(auth, hirer):
    listing = ListingFactory(status=ListingStatus.LIVE)
    conv = _enquiry(auth, hirer, listing)
    auth(hirer).post(f"{CONV}/{conv['id']}/messages", {"body": f"phone {PHONE}"})
    # an unrelated hire between the SAME parties confirms
    hire = HireFactory(listing=listing, hirer=hirer, accepted=True)
    _confirm(hire)
    served = auth(hirer).get(f"{CONV}/{conv['id']}/messages").json()["results"][0]
    assert PHONE not in served["body"]
    assert served["masked"] is True


def test_hire_conversation_unmasks_after_confirmed(auth, hirer):
    listing = ListingFactory(status=ListingStatus.LIVE, unit_count=1)
    hire = HireFactory(listing=listing, hirer=hirer, accepted=True)
    conv = ensure_hire_conversation(hire)
    send_message(user=hirer, conversation_id=conv.id, body=f"reach me {PHONE}")
    pre = auth(hirer).get(f"{CONV}/{conv.id}/messages").json()["results"][0]
    assert PHONE not in pre["body"]
    assert pre["masked"] is True

    _confirm(hire)
    post = auth(hirer).get(f"{CONV}/{conv.id}/messages").json()["results"][0]
    assert PHONE in post["body"]  # unmasked once paid
    assert post["masked"] is False


def test_a_different_hires_conversation_stays_masked(auth, hirer):
    listing = ListingFactory(status=ListingStatus.LIVE, unit_count=2)
    paid = HireFactory(listing=listing, hirer=hirer, accepted=True)
    unpaid = HireFactory(listing=listing, hirer=hirer, accepted=True)
    conv_paid = ensure_hire_conversation(paid)
    conv_unpaid = ensure_hire_conversation(unpaid)
    send_message(user=hirer, conversation_id=conv_paid.id, body=f"phone {PHONE}")
    send_message(user=hirer, conversation_id=conv_unpaid.id, body=f"phone {PHONE}")
    _confirm(paid)

    paid_msg = auth(hirer).get(f"{CONV}/{conv_paid.id}/messages").json()["results"][0]
    unpaid_msg = auth(hirer).get(f"{CONV}/{conv_unpaid.id}/messages").json()["results"][0]
    assert PHONE in paid_msg["body"]
    assert PHONE not in unpaid_msg["body"]


def test_mark_read_clears_counterparty_unread(auth, hirer):
    listing = ListingFactory(status=ListingStatus.LIVE)
    supplier = listing.supplier
    conv = _enquiry(auth, hirer, listing)
    auth(supplier).post(f"{CONV}/{conv['id']}/messages", {"body": "hello there"})
    auth(supplier).post(f"{CONV}/{conv['id']}/messages", {"body": "still available"})

    before = auth(hirer).get(CONV).json()
    assert before["results"][0]["unread_count"] == 2
    assert before["unread_total"] == 2

    marked = auth(hirer).post(READ, {"conversation_id": conv["id"]})
    assert marked.json()["marked_read"] == 2

    after = auth(hirer).get(CONV).json()
    assert after["results"][0]["unread_count"] == 0
    assert after["unread_total"] == 0


def test_own_messages_are_not_unread_for_sender(auth, hirer):
    listing = ListingFactory(status=ListingStatus.LIVE)
    conv = _enquiry(auth, hirer, listing)
    auth(hirer).post(f"{CONV}/{conv['id']}/messages", {"body": "hi"})
    row = auth(hirer).get(CONV).json()["results"][0]
    assert row["unread_count"] == 0


def test_empty_message_rejected(auth, hirer):
    listing = ListingFactory(status=ListingStatus.LIVE)
    conv = _enquiry(auth, hirer, listing)
    resp = auth(hirer).post(f"{CONV}/{conv['id']}/messages", {"body": "   "})
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "empty_message"
