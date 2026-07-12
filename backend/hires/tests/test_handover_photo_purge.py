"""D-026 retention: handover photos purge 90 days after off-hire confirmation."""

from __future__ import annotations

import datetime as dt
from typing import cast
from unittest import mock

import pytest
from django.utils import timezone
from freezegun import freeze_time

from core import media
from hires.enums import HandoverKind, HireStatus
from hires.factories import HireFactory
from hires.models import HandoverRecord, Hire
from hires.tasks import purge_due_handover_photos
from listings.enums import ListingStatus
from listings.factories import ListingFactory

pytestmark = pytest.mark.django_db

CONFIRMED_AT = "2026-03-01 12:00:00"


@pytest.fixture
def local_media(tmp_path, settings):
    settings.MEDIA_ROOT = tmp_path
    return tmp_path


@pytest.fixture
def listing():
    return ListingFactory(status=ListingStatus.LIVE, unit_count=1, daily_price=8_000_000)


def _completed_hire(listing, **kw) -> Hire:
    today = timezone.localdate()
    defaults = {
        "start_date": today - dt.timedelta(days=10),
        "end_date": today - dt.timedelta(days=7),
        "status": HireStatus.COMPLETED,
    }
    defaults.update(kw)
    return cast(Hire, HireFactory(listing=listing, **defaults))


def _handover(hire, kind=HandoverKind.OFF_HIRE, keys=(), confirmed=True) -> HandoverRecord:
    keys = list(keys) or [f"handovers/{kind}-a.jpg", f"handovers/{kind}-b.jpg"]
    for key in keys:
        media.store_private_file(key, f"bytes-{key}".encode(), "image/jpeg")
    return HandoverRecord.objects.create(
        hire=hire,
        kind=kind,
        photos=keys,
        submitted_by=hire.supplier,
        confirmed_by=hire.hirer if confirmed else None,
        confirmed_at=timezone.now() if confirmed else None,
    )


def test_untouched_at_89_days_purged_at_90(listing, local_media):
    with freeze_time(CONFIRMED_AT):
        hire = _completed_hire(listing)
        record = _handover(hire)

    with freeze_time("2026-05-29 12:00:00"):  # day 89
        assert purge_due_handover_photos()["purged"] == 0
        record.refresh_from_db()
        assert record.photos and record.photos_purged_at is None

    with freeze_time("2026-05-30 12:00:00"):  # day 90
        result = purge_due_handover_photos()
    assert result == {"purged": 1, "objects_deleted": 2, "errors": 0}
    record.refresh_from_db()
    assert record.photos == []
    assert record.photos_purged_at is not None
    assert not media.private_file_exists("handovers/off_hire-a.jpg")


def test_on_hire_evidence_purges_with_the_hire(listing, local_media):
    with freeze_time(CONFIRMED_AT):
        hire = _completed_hire(listing)
        on_hire = _handover(hire, kind=HandoverKind.ON_HIRE)
        _handover(hire, kind=HandoverKind.OFF_HIRE)

    with freeze_time("2026-06-15 12:00:00"):
        result = purge_due_handover_photos()
    assert result["purged"] == 2
    on_hire.refresh_from_db()
    assert on_hire.photos == []


def test_unconfirmed_off_hire_never_purges(listing, local_media):
    with freeze_time(CONFIRMED_AT):
        hire = _completed_hire(listing)
        _handover(hire, confirmed=False)

    with freeze_time("2027-01-01 12:00:00"):
        assert purge_due_handover_photos()["purged"] == 0


def test_in_dispute_hire_is_skipped(listing, local_media):
    with freeze_time(CONFIRMED_AT):
        hire = _completed_hire(listing, status=HireStatus.IN_DISPUTE)
        record = _handover(hire)

    with freeze_time("2026-07-01 12:00:00"):
        assert purge_due_handover_photos()["purged"] == 0
    record.refresh_from_db()
    assert record.photos


def test_second_run_is_a_noop(listing, local_media):
    with freeze_time(CONFIRMED_AT):
        hire = _completed_hire(listing)
        _handover(hire)

    with freeze_time("2026-07-01 12:00:00"):
        assert purge_due_handover_photos()["purged"] == 1
        again = purge_due_handover_photos()
    assert again == {"purged": 0, "objects_deleted": 0, "errors": 0}


def test_storage_failure_leaves_record_for_retry(listing, local_media):
    with freeze_time(CONFIRMED_AT):
        hire = _completed_hire(listing)
        record = _handover(hire)

    with freeze_time("2026-07-01 12:00:00"):
        with mock.patch.object(media, "delete_private_file", side_effect=OSError("boom")):
            result = purge_due_handover_photos()
        assert result["errors"] == 1
        record.refresh_from_db()
        assert record.photos and record.photos_purged_at is None
        # The next (healthy) run picks it up.
        assert purge_due_handover_photos()["purged"] == 1


def test_missing_object_is_not_fatal(listing, local_media):
    with freeze_time(CONFIRMED_AT):
        hire = _completed_hire(listing)
        record = _handover(hire)
    media.delete_private_file(record.photos[0])  # already gone from storage

    with freeze_time("2026-07-01 12:00:00"):
        result = purge_due_handover_photos()
    assert result["purged"] == 1
    assert result["errors"] == 0
