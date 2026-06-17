"""Production settings: DEBUG off, secrets and hosts from the platform env."""

from __future__ import annotations

from .base import *  # noqa: F401,F403
from .base import env

DEBUG = False

# Required in prod — fail loudly at boot if unset (these are not integration
# keys; a missing SECRET_KEY/host is a misconfiguration, not a degraded service).
SECRET_KEY = env("SECRET_KEY")
ALLOWED_HOSTS = env("ALLOWED_HOSTS")
CORS_ALLOWED_ORIGINS = env("CORS_ALLOWED_ORIGINS")

# Behind Railway's TLS-terminating proxy.
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
# Railway terminates TLS at the edge; internal health checks use HTTP.
SECURE_SSL_REDIRECT = env.bool("SECURE_SSL_REDIRECT", default=False)
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = 60 * 60 * 24 * 30
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True

EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"

# WhiteNoise serves static directly from gunicorn (no CDN, within budget).
# Compressed + content-hashed manifest gives far-future caching. Manifest
# storage requires `collectstatic` to have run (it does in the Dockerfile) and
# every `{% static %}` reference to resolve — so it's prod-only; dev/test keep
# Django's default storage (no manifest needed for runserver / the test client).
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}
