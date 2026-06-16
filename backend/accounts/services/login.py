"""Login: credential check, account-state guards, and IP failure lockout.

We deliberately do not use ``django.contrib.auth.authenticate`` — its
ModelBackend silently rejects ``is_active=False`` users, which would collapse
the distinct suspended / deleted error codes into a generic failure. Instead we
load the user and apply each guard explicitly.

The lockout (5 *failures* / 15 min / IP) is a cache counter and complements the
coarse ``login`` request-rate throttle on the view — they count different
things (failures vs requests) over different windows.
"""

from __future__ import annotations

from django.contrib.auth.hashers import check_password
from django.core.cache import cache

from accounts.errors import (
    AccountDeleted,
    AccountSuspended,
    InvalidCredentials,
    LoginLocked,
    PhoneNotVerified,
)
from accounts.models import User

MAX_LOGIN_FAILURES = 5
LOCKOUT_TTL_SECONDS = 15 * 60


def client_ip(request) -> str:
    """Best-effort client IP. Behind Railway's proxy the real client is the
    first hop of X-Forwarded-For; fall back to REMOTE_ADDR."""
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR", "")


def _failure_key(ip: str) -> str:
    return f"login-fail:{ip}"


def _record_failure(ip: str) -> None:
    key = _failure_key(ip)
    # add() is a no-op if the key exists, so the TTL is set once per window.
    cache.add(key, 0, LOCKOUT_TTL_SECONDS)
    try:
        cache.incr(key)
    except ValueError:
        # Key expired between add and incr — reseed.
        cache.set(key, 1, LOCKOUT_TTL_SECONDS)


def _is_locked(ip: str) -> bool:
    return (cache.get(_failure_key(ip)) or 0) >= MAX_LOGIN_FAILURES


def _clear_failures(ip: str) -> None:
    cache.delete(_failure_key(ip))


def authenticate(*, request, email: str, password: str) -> User:
    ip = client_ip(request)
    if _is_locked(ip):
        raise LoginLocked()

    # citext email column makes this lookup case-insensitive.
    user = User.objects.filter(email__iexact=email).first()
    if user is None or not check_password(password, user.password):
        _record_failure(ip)
        if _is_locked(ip):
            raise LoginLocked()
        raise InvalidCredentials()

    # Credentials are valid — now the account-state guards.
    if user.is_deleted:
        raise AccountDeleted()
    if user.is_suspended:
        raise AccountSuspended()
    if not user.is_phone_verified:
        raise PhoneNotVerified()

    _clear_failures(ip)
    return user


def assert_user_active(user: User) -> None:
    """Re-checked on token refresh so suspended/deleted users can't keep rotating."""
    if user.is_deleted:
        raise AccountDeleted()
    if user.is_suspended:
        raise AccountSuspended()
