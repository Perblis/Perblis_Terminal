"""Realtime: token scoping, keyless degradation, publish fan-out (TSD §4)."""

from __future__ import annotations

import json

import pytest

from accounts.factories import UserFactory
from core import realtime
from hires import state
from hires.enums import ActorKind
from hires.factories import HireFactory
from listings.enums import ListingStatus
from listings.factories import ListingFactory
from messaging.services import create_enquiry

pytestmark = pytest.mark.django_db

CONV = "/api/v1/conversations"
TOKEN = "/api/v1/realtime/token"
KEY = "app123.keyABC:secretvalue"


def test_token_not_configured_when_keyless(auth, hirer, settings):
    settings.ABLY_API_KEY = ""
    resp = auth(hirer).get(TOKEN)
    assert resp.status_code == 200
    assert resp.json()["status"] == "not_configured"


def test_token_scoped_to_own_channels_only(auth, hirer, settings):
    settings.ABLY_API_KEY = KEY
    listing = ListingFactory(status=ListingStatus.LIVE)
    mine = auth(hirer).post(CONV, {"listing_id": str(listing.id)}).json()
    # a conversation the hirer is NOT a party to
    foreign = create_enquiry(
        user=UserFactory(), listing_id=ListingFactory(status=ListingStatus.LIVE).id
    )

    body = auth(hirer).get(TOKEN).json()
    cap = json.loads(body["capability"])
    assert body["clientId"] == str(hirer.id)
    assert f"user:{hirer.id}" in cap
    assert f"conv:{mine['id']}" in cap
    assert f"conv:{foreign.id}" not in cap  # capability scoping (FSD §8 acceptance)


def test_publish_is_noop_when_keyless(settings):
    settings.ABLY_API_KEY = ""
    assert realtime.publish("conv:x", "message", {"a": 1}) is False


def test_send_message_fans_out_to_conv_and_user(
    auth, hirer, settings, monkeypatch, django_capture_on_commit_callbacks
):
    settings.ABLY_API_KEY = KEY
    calls: list[tuple[str, str]] = []
    monkeypatch.setattr(
        realtime, "publish", lambda channel, name, data: calls.append((channel, name))
    )
    listing = ListingFactory(status=ListingStatus.LIVE)
    conv = auth(hirer).post(CONV, {"listing_id": str(listing.id)}).json()
    with django_capture_on_commit_callbacks(execute=True):
        auth(hirer).post(f"{CONV}/{conv['id']}/messages", {"body": "hi"})
    channels = [c for c, _ in calls]
    assert any(c == f"conv:{conv['id']}" for c in channels)
    assert any(c.startswith("user:") for c in channels)


def test_hire_status_publishes_to_both_parties(
    hirer, settings, monkeypatch, django_capture_on_commit_callbacks
):
    settings.ABLY_API_KEY = KEY
    calls: list[tuple[str, str]] = []
    monkeypatch.setattr(
        realtime, "publish", lambda channel, name, data: calls.append((channel, name))
    )
    listing = ListingFactory(status=ListingStatus.LIVE, unit_count=1)
    hire = HireFactory(listing=listing, hirer=hirer, accepted=True)
    with django_capture_on_commit_callbacks(execute=True):
        state.apply(hire, "pay", actor_kind=str(ActorKind.SYSTEM))
    status_channels = {c for c, n in calls if n == "hire_status"}
    assert f"user:{hire.hirer_id}" in status_channels
    assert f"user:{hire.supplier_id}" in status_channels
