"""Supplier profile API + bank-number encryption (Wave 2 §2.1)."""

from __future__ import annotations

import pytest
from django.db import connection
from django.urls import reverse

from suppliers.models import SupplierProfile

pytestmark = pytest.mark.django_db

URL = "/api/v1/suppliers/me/profile"


def test_url_resolves():
    assert reverse("api:suppliers:me-profile") == URL


def test_get_creates_empty_profile_for_supplier(auth, supplier):
    resp = auth(supplier).get(URL)
    assert resp.status_code == 200
    body = resp.json()
    assert body["business_name"] == ""
    assert body["is_complete"] is False
    assert body["bank_account_number_masked"] == ""
    # No plaintext / ciphertext field ever leaks.
    assert "bank_account_number" not in body
    assert "bank_account_number_enc" not in body


def test_hirer_cannot_access_profile(auth, hirer):
    resp = auth(hirer).get(URL)
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "permission_denied"


def test_patch_completes_profile_and_masks_bank_number(auth, supplier):
    resp = auth(supplier).patch(
        URL,
        {
            "business_name": "Apapa Plant Co",
            "bank_name": "GTBank",
            "bank_account_number": "0123456789",
            "bank_account_name": "Apapa Plant Co",
        },
        format="json",
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["is_complete"] is True
    assert body["bank_account_number_masked"] == "****6789"
    assert "bank_account_number" not in body


def test_bank_number_invalid_format_rejected(auth, supplier):
    resp = auth(supplier).patch(URL, {"bank_account_number": "12ab"}, format="json")
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "validation_error"


def test_bank_number_stored_as_ciphertext_at_rest(auth, supplier):
    auth(supplier).patch(URL, {"bank_account_number": "0123456789"}, format="json")
    profile = SupplierProfile.objects.get(user=supplier)
    # The ORM round-trips plaintext...
    assert profile.bank_account_number_enc == "0123456789"
    # ...but the raw column holds ciphertext, never the plaintext number.
    with connection.cursor() as cur:
        cur.execute(
            "SELECT bank_account_number_enc FROM supplier_profiles WHERE id = %s",
            [str(profile.id)],
        )
        raw = cur.fetchone()[0]
    assert raw != "0123456789"
    assert "0123456789" not in raw
    assert len(raw) > 20  # Fernet token


def test_strike_count_is_read_only(auth, supplier):
    resp = auth(supplier).patch(URL, {"strike_count": 9}, format="json")
    assert resp.status_code == 200
    assert resp.json()["strike_count"] == 0
