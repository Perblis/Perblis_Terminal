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
    ident_field = "phone"

    def get_cache_key(self, request, view):
        ident = (request.data.get(self.ident_field) or "").strip()
        if not ident:
            return None  # nothing to throttle on; view validation rejects it
        return self.cache_format % {"scope": self.scope, "ident": ident}


class EmailOtpSendThrottle(OtpSendThrottle):
    """Same 3/hour cap, keyed per email address for the email channel."""

    ident_field = "email"
