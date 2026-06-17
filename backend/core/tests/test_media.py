"""Media presign pipeline (TSD §3.9): validation + local round-trip."""

from __future__ import annotations

import pytest

from core import media

pytestmark = pytest.mark.django_db

PRESIGN = "/api/v1/media/presign"


def test_presign_requires_auth(api):
    resp = api.post(PRESIGN, {"kind": "logo", "content_type": "image/png", "file_size": 1024})
    assert resp.status_code == 401


def test_presign_logo_returns_key_and_url(auth, supplier):
    resp = auth(supplier).post(
        PRESIGN,
        {"kind": "logo", "content_type": "image/png", "file_size": 1024},
        format="json",
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["bucket"] == "public"
    assert body["key"].startswith("logos/")
    assert body["key"].endswith(".png")
    assert body["presigned_put_url"]
    assert body["expires_in"] == 3600


def test_presign_rejects_oversize(auth, supplier):
    resp = auth(supplier).post(
        PRESIGN,
        {"kind": "listing_photo", "content_type": "image/jpeg", "file_size": 11 * media.MB},
        format="json",
    )
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "media_too_large"


def test_presign_rejects_wrong_content_type(auth, supplier):
    resp = auth(supplier).post(
        PRESIGN,
        {"kind": "logo", "content_type": "application/pdf", "file_size": 1024},
        format="json",
    )
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "media_content_type_invalid"


def test_presign_rejects_unknown_kind(auth, supplier):
    resp = auth(supplier).post(
        PRESIGN,
        {"kind": "nonsense", "content_type": "image/png", "file_size": 1024},
        format="json",
    )
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "validation_error"


def test_verification_doc_accepts_pdf_in_private_bucket(auth, supplier):
    resp = auth(supplier).post(
        PRESIGN,
        {"kind": "verification_doc", "content_type": "application/pdf", "file_size": 1024},
        format="json",
    )
    assert resp.status_code == 200
    assert resp.json()["bucket"] == "private"


def test_local_upload_then_serve_round_trip(auth, supplier):
    presign = (
        auth(supplier)
        .post(
            PRESIGN,
            {"kind": "logo", "content_type": "image/png", "file_size": 5},
            format="json",
        )
        .json()
    )
    key, put_url = presign["key"], presign["presigned_put_url"]

    put = auth(supplier).put(put_url, data=b"hello", content_type="image/png")
    assert put.status_code == 204
    assert media.read_public_file(key) == b"hello"

    served = auth(supplier).get(media.public_url(key))
    assert served.status_code == 200


def test_service_raises_on_unknown_kind_directly():
    with pytest.raises(media.MediaKindInvalid):
        media.presign_upload(kind="nope", content_type="image/png", file_size=10)
