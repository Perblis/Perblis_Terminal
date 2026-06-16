"""The Ops verification queue (Django admin actions)."""

from __future__ import annotations

import pytest
from django.contrib.admin.sites import AdminSite
from django.core import mail
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import RequestFactory

from accounts.admin import VerificationRequestAdmin
from accounts.enums import VerificationState
from accounts.factories import UserFactory
from accounts.models import AccountLevel, VerificationRequest
from accounts.services import verification

pytestmark = pytest.mark.django_db

PNG = SimpleUploadedFile("id.png", b"\x89PNG" + b"0" * 16, content_type="image/png")


def _admin():
    return VerificationRequestAdmin(VerificationRequest, AdminSite())


def _request(staff_user):
    req = RequestFactory().post("/admin/")
    req.user = staff_user
    # message_user needs the messages framework; stub it.
    req._messages = _DummyMessages()
    return req


class _DummyMessages:
    def add(self, *a, **k):
        pass


def test_pending_listed_first(staff_user):
    decided = verification.submit_verification(
        user=UserFactory(),
        kind="identity",
        files=[SimpleUploadedFile("a.png", b"\x89PNG" + b"0" * 8, content_type="image/png")],
    )
    verification.reject(decided, reviewer=staff_user, reason="x")
    pending = verification.submit_verification(
        user=UserFactory(),
        kind="identity",
        files=[SimpleUploadedFile("b.png", b"\x89PNG" + b"0" * 8, content_type="image/png")],
    )
    admin = _admin()
    first = list(admin.get_queryset(_request(staff_user)))[0]
    assert first.pk == pending.pk


def test_approve_action_upgrades_and_notifies(staff_user, user, django_capture_on_commit_callbacks):
    req = verification.submit_verification(user=user, kind="identity", files=[PNG])
    admin = _admin()
    with django_capture_on_commit_callbacks(execute=True):
        admin.approve_requests(_request(staff_user), VerificationRequest.objects.filter(pk=req.pk))
    user.refresh_from_db()
    assert user.account_level == AccountLevel.VERIFIED
    assert len(mail.outbox) >= 1


def test_reject_action_with_reason(staff_user, user, django_capture_on_commit_callbacks):
    req = verification.submit_verification(
        user=user,
        kind="identity",
        files=[SimpleUploadedFile("c.png", b"\x89PNG" + b"0" * 8, content_type="image/png")],
    )
    admin = _admin()
    request = _request(staff_user)
    request.POST = request.POST.copy()
    request.POST["apply"] = "1"
    request.POST["reason"] = "Document unreadable"
    with django_capture_on_commit_callbacks(execute=True):
        admin.reject_requests(request, VerificationRequest.objects.filter(pk=req.pk))
    req.refresh_from_db()
    assert req.state == VerificationState.REJECTED
    assert req.reason == "Document unreadable"
