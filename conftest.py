import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

User = get_user_model()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def create_user(db):
    def _create_user(**kwargs):
        defaults = {
            'email': 'test@example.com',
            'phone': '08000000001',
            'first_name': 'Test',
            'last_name': 'User',
            'is_renter': True,
            'is_owner': False,
            'is_email_verified': True,
            'is_phone_verified': True,
        }
        defaults.update(kwargs)
        password = defaults.pop('password', 'testpass123!')
        user = User(**defaults)
        user.set_password(password)
        user.save()
        return user
    return _create_user


@pytest.fixture
def renter_user(create_user):
    return create_user(
        email='renter@test.com',
        phone='08011111111',
        is_renter=True,
        is_owner=False,
    )


@pytest.fixture
def owner_user(create_user):
    return create_user(
        email='owner@test.com',
        phone='08022222222',
        is_renter=False,
        is_owner=True,
    )


@pytest.fixture
def second_owner_user(create_user):
    return create_user(
        email='owner2@test.com',
        phone='08044444444',
        is_renter=False,
        is_owner=True,
    )


@pytest.fixture
def dual_user(create_user):
    return create_user(
        email='dual@test.com',
        phone='08033333333',
        is_renter=True,
        is_owner=True,
    )


@pytest.fixture
def auth_client(api_client, renter_user):
    api_client.force_authenticate(user=renter_user)
    return api_client


@pytest.fixture
def owner_client(api_client, owner_user):
    api_client.force_authenticate(user=owner_user)
    return api_client


@pytest.fixture
def second_owner_client(api_client, second_owner_user):
    api_client.force_authenticate(user=second_owner_user)
    return api_client


@pytest.fixture
def dual_client(api_client, dual_user):
    api_client.force_authenticate(user=dual_user)
    return api_client
