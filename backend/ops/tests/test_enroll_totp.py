"""The enroll_totp management command (Ops Console 2FA enrolment / lockout recovery)."""

from __future__ import annotations

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError
from django_otp.plugins.otp_totp.models import TOTPDevice

from accounts.factories import UserFactory

pytestmark = pytest.mark.django_db


def test_enrolls_confirmed_device_for_staff(capsys):
    staff = UserFactory(staff=True)
    call_command("enroll_totp", staff.email, "--no-qr")

    device = TOTPDevice.objects.get(user=staff)
    assert device.confirmed is True
    out = capsys.readouterr().out
    assert "otpauth://" in out


def test_rejects_non_staff_user():
    hirer = UserFactory()
    with pytest.raises(CommandError, match="not staff"):
        call_command("enroll_totp", hirer.email, "--no-qr")


def test_rejects_unknown_email():
    with pytest.raises(CommandError, match="No user"):
        call_command("enroll_totp", "nobody@example.com", "--no-qr")


def test_existing_device_requires_rotate(capsys):
    staff = UserFactory(staff=True)
    call_command("enroll_totp", staff.email, "--no-qr")
    with pytest.raises(CommandError, match="--rotate"):
        call_command("enroll_totp", staff.email, "--no-qr")

    # --rotate replaces it in place (still exactly one device of that name).
    call_command("enroll_totp", staff.email, "--no-qr", "--rotate")
    assert TOTPDevice.objects.filter(user=staff, name="default").count() == 1
