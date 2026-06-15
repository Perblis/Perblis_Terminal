"""Role permission stubs read the User flags/level (TSD §3.3)."""

from __future__ import annotations

from types import SimpleNamespace

from core.permissions import IsHirer, IsSupplier, IsVerified


def _request(**attrs):
    user = SimpleNamespace(is_authenticated=True, **attrs)
    return SimpleNamespace(user=user)


def test_is_supplier():
    assert IsSupplier().has_permission(_request(is_supplier=True), None) is True
    assert IsSupplier().has_permission(_request(is_supplier=False), None) is False


def test_is_hirer():
    assert IsHirer().has_permission(_request(is_hirer=True), None) is True
    assert IsHirer().has_permission(_request(is_hirer=False), None) is False


def test_is_verified():
    assert IsVerified().has_permission(_request(is_verified=True), None) is True
    assert IsVerified().has_permission(_request(is_verified=False), None) is False


def test_anonymous_is_denied():
    anon = SimpleNamespace(user=SimpleNamespace(is_authenticated=False))
    assert IsSupplier().has_permission(anon, None) is False
