"""Error envelope shape on 400 / 404 / 500 (TSD §3.8)."""

from __future__ import annotations

from rest_framework.exceptions import NotFound, ValidationError

from core.exceptions import terminal_exception_handler


def _ctx():
    return {"view": None, "request": None}


def test_validation_error_carries_fields():
    exc = ValidationError({"email": ["This field is required."]})
    response = terminal_exception_handler(exc, _ctx())
    assert response.status_code == 400
    assert set(response.data["error"]) == {"code", "message", "fields"}
    assert response.data["error"]["code"] == "validation_error"
    assert "email" in response.data["error"]["fields"]


def test_not_found_envelope():
    response = terminal_exception_handler(NotFound(), _ctx())
    assert response.status_code == 404
    assert response.data["error"]["code"] == "not_found"
    assert "fields" not in response.data["error"]


def test_unhandled_exception_is_server_error_envelope():
    response = terminal_exception_handler(RuntimeError("boom"), _ctx())
    assert response.status_code == 500
    assert response.data["error"]["code"] == "server_error"
    # Internal detail is never leaked in the message.
    assert "boom" not in response.data["error"]["message"]
