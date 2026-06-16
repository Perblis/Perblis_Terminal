"""JWT minting and refresh re-validation.

Login mints tokens carrying the claims the clients branch on. Refresh re-loads
the user and re-checks suspension / soft-delete / token_version, because
simplejwt's default refresh trusts the refresh token without touching the DB —
a suspended user could otherwise keep rotating tokens for 7 days.
"""

from __future__ import annotations

from rest_framework_simplejwt.exceptions import InvalidToken
from rest_framework_simplejwt.serializers import (
    TokenObtainPairSerializer,
    TokenRefreshSerializer,
)
from rest_framework_simplejwt.tokens import Token

from accounts.models import User


def add_claims(token: Token, user: User) -> Token:
    """Attach Terminal's standard claims (FSD §4.2) to a token."""
    token["user_id"] = str(user.id)
    token["is_supplier"] = user.is_supplier
    token["is_hirer"] = user.is_hirer
    token["account_level"] = user.account_level
    token["is_active"] = user.is_active
    token["tv"] = user.token_version
    return token


class TerminalTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        return add_claims(token, user)


def tokens_for_user(user: User) -> dict[str, str]:
    """Mint an access+refresh pair with Terminal claims for an authenticated user."""
    refresh = TerminalTokenObtainPairSerializer.get_token(user)
    return {"access": str(refresh.access_token), "refresh": str(refresh)}  # type: ignore[attr-defined]


class TerminalTokenRefreshSerializer(TokenRefreshSerializer):
    """Refresh that re-validates the account.

    simplejwt's default refresh trusts the refresh token without a DB lookup, so
    a suspended or soft-deleted user — or one whose sessions were invalidated by
    a token_version bump — could keep rotating tokens for up to 7 days. We
    re-load the user and re-apply the guards before issuing anything.
    """

    def validate(self, attrs):
        from accounts.services.login import assert_user_active

        # Parse the incoming refresh to inspect its claims before rotation.
        refresh = self.token_class(attrs["refresh"])  # type: ignore[attr-defined]
        user_id = refresh.get(api_user_id_claim(), None)
        user = User.objects.filter(pk=user_id).first()
        if user is None:
            raise InvalidToken("User no longer exists.")
        assert_user_active(user)
        if refresh.get("tv") != user.token_version:
            raise InvalidToken("Token has been revoked.")

        return super().validate(attrs)


def api_user_id_claim() -> str:
    from rest_framework_simplejwt.settings import api_settings

    return api_settings.USER_ID_CLAIM
