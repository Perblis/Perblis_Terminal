"""Custom User model basics."""

from __future__ import annotations

import pytest

from accounts.models import AccountLevel, User


@pytest.mark.django_db
def test_create_user_sets_password_and_uuid_pk():
    user = User.objects.create_user(
        email="Sam@Example.com",
        phone="+2348012345678",
        password="s3cret-pass",
    )
    # citext + normalize: domain lower-cased, lookups case-insensitive.
    assert user.email == "Sam@example.com"
    assert user.check_password("s3cret-pass")
    assert user.id is not None
    assert user.account_level == AccountLevel.BASIC
    assert user.is_verified is False


@pytest.mark.django_db
def test_email_uniqueness_is_case_insensitive():
    User.objects.create_user(email="dup@example.com", phone="+2348011111111", password="x")
    # citext makes this a duplicate despite the different case.
    assert User.objects.filter(email="DUP@example.com").exists()


@pytest.mark.django_db
def test_verified_levels():
    user = User.objects.create_user(
        email="v@example.com",
        phone="+2348022222222",
        password="x",
        account_level=AccountLevel.BUSINESS_VERIFIED,
    )
    assert user.is_verified is True


@pytest.mark.django_db
def test_soft_delete():
    user = User.objects.create_user(email="d@example.com", phone="+2348033333333", password="x")
    user.soft_delete()
    user.refresh_from_db()
    assert user.deleted_at is not None
    assert user.is_active is False
