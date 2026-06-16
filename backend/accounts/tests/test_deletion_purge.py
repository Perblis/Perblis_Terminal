"""Account deletion + purge with NDPR carve-outs."""

from __future__ import annotations

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from freezegun import freeze_time

from accounts.models import User, VerificationRequest
from accounts.services import verification
from accounts.tasks import purge_soft_deleted_accounts

pytestmark = pytest.mark.django_db


def test_delete_me_soft_deletes(auth, user):
    resp = auth(user).delete(reverse("api:accounts:me"))
    assert resp.status_code == 204
    user.refresh_from_db()
    assert user.is_deleted
    assert user.is_active is False


def test_soft_deleted_recoverable_within_30_days(user):
    with freeze_time("2026-06-16 12:00:00"):
        user.soft_delete()
    # 29 days later the purge leaves it alone (recovery window still open).
    with freeze_time("2026-07-15 12:00:00"):
        purged = purge_soft_deleted_accounts.func()
    assert purged == 0
    user.refresh_from_db()
    assert user.purged_at is None


def test_purge_scrubs_after_30_days_but_keeps_verification(user):
    req = verification.submit_verification(
        user=user,
        kind="identity",
        files=[SimpleUploadedFile("id.png", b"\x89PNG" + b"0" * 16, content_type="image/png")],
    )
    original_email = user.email
    with freeze_time("2026-06-16 12:00:00"):
        user.soft_delete()
    with freeze_time("2026-07-17 12:00:00"):
        purged = purge_soft_deleted_accounts.func()
    assert purged == 1
    user.refresh_from_db()
    assert user.purged_at is not None
    assert user.email != original_email  # PII scrubbed
    assert not user.has_usable_password()
    # NDPR carve-out: the verification record survives the purge.
    assert VerificationRequest.objects.filter(pk=req.pk).exists()


def test_purge_is_idempotent(user):
    with freeze_time("2026-06-16 12:00:00"):
        user.soft_delete()
    with freeze_time("2026-07-17 12:00:00"):
        first = purge_soft_deleted_accounts.func()
        second = purge_soft_deleted_accounts.func()
    assert first == 1
    assert second == 0  # double-run is a no-op


def test_active_user_not_purged(user):
    with freeze_time("2026-07-17 12:00:00"):
        assert purge_soft_deleted_accounts.func() == 0
    assert User.objects.filter(pk=user.pk).exists()
