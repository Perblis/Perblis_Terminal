"""JWT authentication that honours the `tv` (token_version) claim.

simplejwt's blacklist only kills *refresh* tokens; an already-issued access
token stays valid until it expires (up to 60 min). Terminal needs an immediate
kill-switch for logout-all and password-reset-confirm, so every token carries a
`tv` claim equal to `user.token_version` at mint time. Bumping the user's
`token_version` makes all outstanding access (and refresh) tokens fail here.
"""

from __future__ import annotations

from drf_spectacular.contrib.rest_framework_simplejwt import SimpleJWTScheme
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken


class TerminalJWTAuthentication(JWTAuthentication):
    def get_user(self, validated_token):
        user = super().get_user(validated_token)
        token_tv = validated_token.get("tv")
        if token_tv is None:
            raise InvalidToken("Token has been revoked.")
        if int(str(token_tv)) != int(str(user.token_version)):
            raise InvalidToken("Token has been revoked.")
        return user


class TerminalJWTScheme(SimpleJWTScheme):
    """Tell drf-spectacular our auth class is bearer-JWT (like simplejwt's)."""

    target_class = "accounts.authentication.TerminalJWTAuthentication"
    name = "jwtAuth"
