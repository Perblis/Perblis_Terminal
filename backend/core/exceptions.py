"""Error envelope (TSD §3.8).

Every API error renders as:

    {"error": {"code": "<stable_code>", "message": "<human>", "fields"?: {...}}}

`code` is a stable, machine-readable string clients branch on; `message` is
human-facing; `fields` carries per-field validation detail on 400s. Domain
code raises `TerminalError` (or its subclasses) to set a specific code; DRF's
own exceptions get mapped to sensible defaults.
"""

from __future__ import annotations

from rest_framework import status
from rest_framework.exceptions import APIException, ValidationError
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler

# Default code per HTTP status when the exception doesn't carry its own.
_STATUS_CODES = {
    400: "validation_error",
    401: "authentication_required",
    403: "permission_denied",
    404: "not_found",
    405: "method_not_allowed",
    406: "not_acceptable",
    409: "conflict",
    415: "unsupported_media_type",
    429: "throttled",
    500: "server_error",
}


class TerminalError(APIException):
    """Base for domain errors that carry a stable error code.

    Subclasses set `default_code`/`status_code`/`default_detail`, e.g.
    availability_conflict, verification_required, payment_window_expired.
    """

    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = "Request could not be processed."
    default_code = "error"


def _envelope(code: str, message: str, fields: dict | None = None) -> dict:
    error: dict = {"code": code, "message": message}
    if fields:
        error["fields"] = fields
    return {"error": error}


def terminal_exception_handler(exc, context):
    response = drf_exception_handler(exc, context)
    if response is None:
        # Unhandled exception -> 500 with a stable envelope (detail is logged,
        # not leaked).
        return Response(
            _envelope("server_error", "An unexpected error occurred."),
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    status_code = response.status_code
    default_code = _STATUS_CODES.get(status_code, "error")

    if isinstance(exc, ValidationError):
        # DRF puts field errors in the data; surface them under `fields`.
        fields = response.data if isinstance(response.data, dict) else None
        message = "The request was invalid."
        response.data = _envelope(default_code, message, fields)
        return response

    code = getattr(exc, "default_code", None) or default_code
    detail = response.data.get("detail") if isinstance(response.data, dict) else None
    message = str(detail) if detail else str(response.data)
    response.data = _envelope(code, message)
    return response
