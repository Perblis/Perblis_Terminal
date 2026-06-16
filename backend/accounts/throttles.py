"""Custom throttles for the auth endpoints."""

from __future__ import annotations

from rest_framework.throttling import ScopedRateThrottle


class OtpSendThrottle(ScopedRateThrottle):
    """Throttle OTP sends per *phone number* (TSD §3.8: 3/h/phone).

    ScopedRateThrottle keys by user/IP by default; OTP resends are
    unauthenticated and must be capped per phone, so we key on the phone in the
    request body. The `otp_send` rate (3/hour) is configured in settings.
    """

    scope = "otp_send"

    def get_cache_key(self, request, view):
        phone = (request.data.get("phone") or "").strip()
        if not phone:
            return None  # nothing to throttle on; view validation rejects it
        return self.cache_format % {"scope": self.scope, "ident": phone}
