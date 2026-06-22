"""Ops Console 2FA (django-otp) — the TSD §7 admin-hardening gate.

Mandatory test (wave-6.md): staff login without a confirmed/verified OTP device
must be denied when 2FA is enforced.
"""

from __future__ import annotations

import pytest
from django.contrib import admin
from django.test import RequestFactory
from django_otp import DEVICE_ID_SESSION_KEY
from django_otp.plugins.otp_totp.models import TOTPDevice

from accounts.factories import UserFactory
from ops.admin_site import OpsAdminSite, OpsOTPAdminSite

pytestmark = pytest.mark.django_db


def _admin_request(user):
    request = RequestFactory().get("/admin/")
    request.user = user
    return request


def test_otp_site_denies_staff_without_verified_device():
    """OTPAdminSite refuses an authenticated-but-not-OTP-verified staff user."""
    staff = UserFactory(staff=True)
    request = _admin_request(staff)
    # OTPMiddleware annotates is_verified(); simulate the unverified outcome.
    staff.is_verified = lambda: False
    assert OpsOTPAdminSite().has_permission(request) is False


def test_otp_site_allows_verified_staff():
    staff = UserFactory(staff=True)
    request = _admin_request(staff)
    staff.is_verified = lambda: True
    assert OpsOTPAdminSite().has_permission(request) is True


def test_otp_site_denies_non_staff_even_if_verified():
    hirer = UserFactory()  # not staff
    request = _admin_request(hirer)
    hirer.is_verified = lambda: True
    assert OpsOTPAdminSite().has_permission(request) is False


def test_plain_site_allows_staff_without_otp():
    """Dev/CI site (2FA off) lets staff in on password alone."""
    staff = UserFactory(staff=True)
    assert OpsAdminSite().has_permission(_admin_request(staff)) is True


@pytest.fixture
def otp_admin_site():
    """Swap the live admin site to the 2FA-enforced class for the test."""
    original = admin.site.__class__
    admin.site.__class__ = OpsOTPAdminSite
    try:
        yield
    finally:
        admin.site.__class__ = original


def test_enrolled_and_verified_staff_reaches_admin(client, otp_admin_site):
    staff = UserFactory(staff=True)
    device = TOTPDevice.objects.create(user=staff, name="default", confirmed=True)
    client.force_login(staff)
    session = client.session
    session[DEVICE_ID_SESSION_KEY] = device.persistent_id
    session.save()

    response = client.get("/admin/")
    assert response.status_code == 200


def test_staff_without_device_is_blocked_from_admin(client, otp_admin_site):
    staff = UserFactory(staff=True)
    client.force_login(staff)  # logged in, but no OTP device verified

    response = client.get("/admin/")
    # OTPAdminSite treats an unverified session as not-logged-in → redirect to login.
    assert response.status_code == 302
    assert "/admin/login/" in response.url
