"""Development settings: DEBUG on, console email, permissive hosts."""

from __future__ import annotations

from .base import *  # noqa: F401,F403
from .base import env

DEBUG = True

ALLOWED_HOSTS = ["*"]

# Email lands in Mailpit (docker compose) over SMTP; if unreachable, Django
# still won't crash on send in dev. Console fallback when SMTP host unset.
if env("EMAIL_HOST", default=""):
    EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
    EMAIL_HOST = env("EMAIL_HOST", default="localhost")
    EMAIL_PORT = env.int("EMAIL_PORT", default=1025)
else:
    EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"

CORS_ALLOWED_ORIGINS = env("CORS_ALLOWED_ORIGINS", default=["http://localhost:3000"])
