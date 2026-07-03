"""E2E_FIXED_OTP guard tests (Wave 7 slice 7-0, TSD §8).

The fixed code is a test-harness hook only: honoured under DEBUG, refused
loudly anywhere else — never simulate trust outside dev (design.md §2).
"""

from __future__ import annotations

import pytest
from django.core.exceptions import ImproperlyConfigured
from django.test import override_settings

from accounts.services import otp


@override_settings(E2E_FIXED_OTP="424242", DEBUG=True)
def test_fixed_code_returned_under_debug():
    assert otp._generate_code() == "424242"


@override_settings(E2E_FIXED_OTP="424242", DEBUG=False)
def test_fixed_code_refused_outside_debug():
    with pytest.raises(ImproperlyConfigured):
        otp._generate_code()


@override_settings(E2E_FIXED_OTP="", DEBUG=False)
def test_random_code_when_unset():
    code = otp._generate_code()
    assert len(code) == otp.OTP_LENGTH
    assert code.isdigit()
