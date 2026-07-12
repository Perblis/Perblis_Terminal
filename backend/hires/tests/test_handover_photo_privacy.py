"""Handover photos are private-bucket (D-025): presign, serving, migration."""

from __future__ import annotations

import datetime as dt
from typing import cast

import pytest
from django.core.management import call_command
from django.utils import timezone

from core import media
from hires.factories import HireFactory
from hires.models import HandoverRecord, Hire
from listings.enums import ListingStatus
from listings.factories import ListingFactory

pytestmark = pytest.mark.django_db

PHOTOS = ["handovers/one.jpg", "handovers/two.jpg"]


@pytest.fixture
def listing():
    return ListingFactory(status=ListingStatus.LIVE, unit_count=1, daily_price=8_000_000)


def _hire(listing, **kw) -> Hire:
    today = timezone.localdate()
    defaults = {"start_date": today, "end_date": today + dt.timedelta(days=2)}
    defaults.update(kw)
    return cast(Hire, HireFactory(listing=listing, **defaults))


def _handover(hire, photos=PHOTOS) -> HandoverRecord:
    return HandoverRecord.objects.create(
        hire=hire, kind="on_hire", photos=list(photos), submitted_by=hire.supplier
    )


# --- presign targets the private bucket ---------------------------------------
def test_handover_presign_is_private_bucket(auth, hirer):
    resp = auth(hirer).post(
        "/api/v1/media/presign",
        {"kind": "handover_photo", "content_type": "image/jpeg", "file_size": 1024},
        format="json",
    )
    assert resp.status_code == 200
    assert resp.json()["bucket"] == "private"


# --- serializer emits short-lived private URLs ---------------------------------
def test_photo_urls_are_presigned_never_public(auth, listing, tmp_path, settings):
    settings.MEDIA_ROOT = tmp_path
    hire = _hire(listing, confirmed=True)
    handover = _handover(hire)
    body = auth(hire.hirer).get(f"/api/v1/hires/{hire.id}/handovers").json()
    record = next(r for r in body if r["id"] == str(handover.id))
    assert record["photos"] == PHOTOS
    assert len(record["photo_urls"]) == 2
    for url in record["photo_urls"]:
        assert "/media/private?t=" in url  # local presign stand-in
        assert "/media/public" not in url


def test_presigned_url_serves_the_photo(auth, listing, tmp_path, settings):
    settings.MEDIA_ROOT = tmp_path
    media.store_private_file(PHOTOS[0], b"front-of-truck", "image/jpeg")
    hire = _hire(listing, confirmed=True)
    handover = _handover(hire)
    body = auth(hire.hirer).get(f"/api/v1/hires/{hire.id}/handovers").json()
    record = next(r for r in body if r["id"] == str(handover.id))
    resp = auth(hire.hirer).get(record["photo_urls"][0])
    assert resp.status_code == 200
    assert b"".join(resp.streaming_content) == b"front-of-truck"


def test_private_serve_rejects_bad_token(api):
    assert api.get("/api/v1/media/private", {"t": "forged:token"}).status_code == 404


def test_non_party_still_404s_the_records(auth, hirer, listing):
    hire = _hire(listing, confirmed=True)
    _handover(hire)
    assert auth(hirer).get(f"/api/v1/hires/{hire.id}/handovers").status_code == 404


# --- public→private migration command ------------------------------------------
@pytest.fixture
def local_media(tmp_path, settings):
    settings.MEDIA_ROOT = tmp_path
    return tmp_path


def test_migrate_moves_public_to_private(listing, local_media):
    hire = _hire(listing, confirmed=True)
    _handover(hire)
    for key in PHOTOS:
        media.store_public_file(key, f"bytes-{key}".encode(), "image/jpeg")

    call_command("migrate_handover_photos")

    for key in PHOTOS:
        assert media.read_private_file(key) == f"bytes-{key}".encode()
        with pytest.raises(FileNotFoundError):
            media.read_public_file(key)


def test_migrate_is_idempotent_and_tolerates_missing(listing, local_media, capsys):
    hire = _hire(listing, confirmed=True)
    _handover(hire, photos=["handovers/kept.jpg", "handovers/gone.jpg"])
    media.store_public_file("handovers/kept.jpg", b"kept", "image/jpeg")
    # "gone.jpg" exists nowhere — must be logged, not fatal.

    call_command("migrate_handover_photos")
    call_command("migrate_handover_photos")  # second run: everything skipped

    assert media.read_private_file("handovers/kept.jpg") == b"kept"
    out = capsys.readouterr().out
    assert "1 already private" in out
    assert "1 missing" in out


def test_migrate_dry_run_touches_nothing(listing, local_media):
    hire = _hire(listing, confirmed=True)
    _handover(hire, photos=["handovers/dry.jpg", "handovers/dry2.jpg"])
    media.store_public_file("handovers/dry.jpg", b"dry", "image/jpeg")
    media.store_public_file("handovers/dry2.jpg", b"dry2", "image/jpeg")

    call_command("migrate_handover_photos", "--dry-run")

    assert media.read_public_file("handovers/dry.jpg") == b"dry"
    assert not media.private_file_exists("handovers/dry.jpg")
