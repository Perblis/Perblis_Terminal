"""Wave 4C hookup: hire conversation auto-create + backfill (FSD §8 acceptance)."""

from __future__ import annotations

import pytest
from django.core.management import call_command

from hires import services as hire_services
from hires.enums import HireStatus
from hires.factories import HireFactory
from hires.models import HireEvent
from listings.enums import ListingStatus
from listings.factories import ListingFactory
from messaging.models import Conversation
from messaging.services import ensure_hire_conversation

pytestmark = pytest.mark.django_db


def test_accept_auto_creates_hire_conversation(django_capture_on_commit_callbacks):
    listing = ListingFactory(status=ListingStatus.LIVE, unit_count=1)
    hire = HireFactory(listing=listing)  # requested
    with django_capture_on_commit_callbacks(execute=True):
        hire_services.accept_hire(user=listing.supplier, hire_id=hire.id)
    conv = Conversation.objects.get(hire=hire)
    assert conv.kind == "hire"
    assert conv.hirer_id == hire.hirer_id
    assert conv.supplier_id == hire.supplier_id
    assert conv.listing_id == hire.listing_id


def test_ensure_hire_conversation_is_idempotent():
    listing = ListingFactory(status=ListingStatus.LIVE)
    hire = HireFactory(listing=listing, accepted=True)
    c1 = ensure_hire_conversation(hire)
    c2 = ensure_hire_conversation(hire)
    assert c1.id == c2.id
    assert Conversation.objects.filter(hire=hire).count() == 1


def test_backfill_creates_missing_and_is_idempotent():
    listing = ListingFactory(status=ListingStatus.LIVE, unit_count=1)
    hire = HireFactory(listing=listing, accepted=True)
    # simulate the Wave 4C gap: an accept event but no conversation
    HireEvent.objects.create(
        hire=hire,
        actor_kind="system",
        from_status=str(HireStatus.REQUESTED),
        to_status=str(HireStatus.ACCEPTED),
    )
    assert not Conversation.objects.filter(hire=hire).exists()

    call_command("backfill_hire_conversations")
    assert Conversation.objects.filter(hire=hire).count() == 1

    call_command("backfill_hire_conversations")  # idempotent
    assert Conversation.objects.filter(hire=hire).count() == 1
