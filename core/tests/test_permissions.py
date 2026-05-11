import pytest
from unittest.mock import MagicMock
from core.permissions import IsOwnerRole, IsRenterRole, IsObjectOwner


@pytest.mark.unit
class TestIsOwnerRole:
    def setup_method(self):
        self.permission = IsOwnerRole()
        self.view = MagicMock()

    def _make_request(self, is_authenticated=True, is_owner=False):
        request = MagicMock()
        request.user.is_authenticated = is_authenticated
        request.user.is_owner = is_owner
        return request

    def test_allows_owner_user(self):
        request = self._make_request(is_authenticated=True, is_owner=True)
        assert self.permission.has_permission(request, self.view) is True

    def test_denies_non_owner(self):
        request = self._make_request(is_authenticated=True, is_owner=False)
        assert self.permission.has_permission(request, self.view) is False

    def test_denies_unauthenticated(self):
        request = self._make_request(is_authenticated=False, is_owner=False)
        assert self.permission.has_permission(request, self.view) is False


@pytest.mark.unit
class TestIsRenterRole:
    def setup_method(self):
        self.permission = IsRenterRole()
        self.view = MagicMock()

    def _make_request(self, is_authenticated=True, is_renter=False):
        request = MagicMock()
        request.user.is_authenticated = is_authenticated
        request.user.is_renter = is_renter
        return request

    def test_allows_renter_user(self):
        request = self._make_request(is_authenticated=True, is_renter=True)
        assert self.permission.has_permission(request, self.view) is True

    def test_denies_non_renter(self):
        request = self._make_request(is_authenticated=True, is_renter=False)
        assert self.permission.has_permission(request, self.view) is False

    def test_denies_unauthenticated(self):
        request = self._make_request(is_authenticated=False)
        assert self.permission.has_permission(request, self.view) is False


@pytest.mark.unit
class TestIsObjectOwner:
    def setup_method(self):
        self.permission = IsObjectOwner()
        self.view = MagicMock()

    def test_allows_object_owner(self):
        user = MagicMock()
        obj = MagicMock()
        obj.owner = user
        request = MagicMock()
        request.user = user
        assert self.permission.has_object_permission(request, self.view, obj) is True

    def test_denies_non_owner(self):
        user = MagicMock()
        other_user = MagicMock()
        obj = MagicMock()
        obj.owner = other_user
        request = MagicMock()
        request.user = user
        assert self.permission.has_object_permission(request, self.view, obj) is False
