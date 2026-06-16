"""Verification: submit, one-pending-per-kind, approve/reject, doc privacy."""

from __future__ import annotations

import pytest
from django.core import mail
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse

from accounts.enums import VerificationState
from accounts.errors import VerificationDocInvalid
from accounts.models import AccountLevel, VerificationRequest
from accounts.services import verification

pytestmark = pytest.mark.django_db

PNG = b"\x89PNG\r\n\x1a\n" + b"0" * 32


def _doc(name="id.png", content_type="image/png", data=PNG):
    return SimpleUploadedFile(name, data, content_type=content_type)


def test_submit_identity_creates_pending(auth, user):
    resp = auth(user).post(
        reverse("api:accounts:verification"),
        {"kind": "identity", "documents": [_doc()]},
        format="multipart",
    )
    assert resp.status_code == 201
    req = VerificationRequest.objects.get(user=user)
    assert req.state == VerificationState.PENDING
    assert len(req.doc_keys) == 1


def test_one_pending_per_kind(auth, user):
    url = reverse("api:accounts:verification")
    auth(user).post(url, {"kind": "identity", "documents": [_doc()]}, format="multipart")
    second = auth(user).post(url, {"kind": "identity", "documents": [_doc()]}, format="multipart")
    assert second.status_code == 409
    assert second.json()["error"]["code"] == "verification_pending"


def test_business_requires_rc_number(auth, user):
    resp = auth(user).post(
        reverse("api:accounts:verification"),
        {"kind": "business", "documents": [_doc(content_type="application/pdf", name="cac.pdf")]},
        format="multipart",
    )
    assert resp.status_code == 400


def test_reject_content_type(auth, user):
    resp = auth(user).post(
        reverse("api:accounts:verification"),
        {"kind": "identity", "documents": [_doc(name="x.gif", content_type="image/gif")]},
        format="multipart",
    )
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "verification_doc_invalid"


def test_approve_identity_upgrades_to_verified(
    user, staff_user, django_capture_on_commit_callbacks
):
    req = verification.submit_verification(user=user, kind="identity", files=[_doc()])
    with django_capture_on_commit_callbacks(execute=True):
        verification.approve(req, reviewer=staff_user)
    user.refresh_from_db()
    assert user.account_level == AccountLevel.VERIFIED
    assert any("verification" in m.subject.lower() for m in mail.outbox)


def test_reject_requires_reason_and_allows_resubmit(
    user, staff_user, django_capture_on_commit_callbacks
):
    req = verification.submit_verification(user=user, kind="identity", files=[_doc()])
    with pytest.raises(VerificationDocInvalid):
        verification.reject(req, reviewer=staff_user, reason="  ")
    with django_capture_on_commit_callbacks(execute=True):
        verification.reject(req, reviewer=staff_user, reason="Blurry document")
    req.refresh_from_db()
    assert req.state == VerificationState.REJECTED
    assert req.reason == "Blurry document"
    # User sees the reason and can resubmit (no pending blocks it now).
    resubmitted = verification.submit_verification(user=user, kind="identity", files=[_doc()])
    assert resubmitted.state == VerificationState.PENDING


def test_status_endpoint_shows_level_and_requests(auth, user):
    verification.submit_verification(user=user, kind="identity", files=[_doc()])
    resp = auth(user).get(reverse("api:accounts:verification"))
    assert resp.status_code == 200
    body = resp.json()
    assert body["account_level"] == user.account_level
    assert len(body["requests"]) == 1
    # The serializer never leaks raw document keys to the user.
    assert "doc_keys" not in body["requests"][0]


def test_doc_keys_are_not_public(user):
    from django.conf import settings

    req = verification.submit_verification(user=user, kind="identity", files=[_doc()])
    for key in req.doc_keys:
        assert key.startswith("verification/")
        # Never under the public base URL / static path.
        assert settings.R2_PUBLIC_BASE_URL == "" or settings.R2_PUBLIC_BASE_URL not in key
        assert not key.startswith(settings.STATIC_URL)
