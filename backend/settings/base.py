"""Base settings shared by all environments.

Config is read from the environment via django-environ. Secrets and per-env
values live in `.env` (dev) or the platform env (prod) — never in source.
See `.env.example` for the exhaustive variable list (TSD §2.2).
"""

from __future__ import annotations

from datetime import timedelta
from pathlib import Path

import environ
import structlog

# backend/settings/base.py -> backend/
BASE_DIR = Path(__file__).resolve().parent.parent

env = environ.Env(
    DEBUG=(bool, False),
    ALLOWED_HOSTS=(list, []),
    CORS_ALLOWED_ORIGINS=(list, []),
)

# Read .env if present; absence is fine (prod injects real env vars).
environ.Env.read_env(BASE_DIR / ".env")

SECRET_KEY = env("SECRET_KEY", default="dev-insecure-change-me")
DEBUG = env("DEBUG")
ALLOWED_HOSTS = env("ALLOWED_HOSTS")

# --- Applications --------------------------------------------------------

DJANGO_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.gis",
    "django.contrib.postgres",
]

THIRD_PARTY_APPS = [
    "rest_framework",
    "rest_framework_gis",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "drf_spectacular",
    "django_filters",
    "corsheaders",
    "django_tasks",
    "django_tasks_db",
]

# Project apps. `core` and `accounts` carry Wave 0 content; the rest are
# registered now (empty) so settings, migrations layout, and coverage config
# stay stable as later waves fill them in.
LOCAL_APPS = [
    "core",
    "accounts",
    "suppliers",
    "listings",
    "search",
    "hires",
    "payments",
    "messaging",
    "ops",
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "urls"
WSGI_APPLICATION = "wsgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

# --- Database (PostGIS) --------------------------------------------------

DATABASES = {
    "default": env.db_url(
        "DATABASE_URL",
        default="postgis://postgres:postgres@localhost:5432/terminal",
    ),
}
# django-environ maps the postgis:// scheme to the GIS backend.

# Tasks: Postgres is the broker (django-tasks + django-tasks-db). No Redis,
# no Celery (D-010). The DB backend ships in the django-tasks-db package; the
# worker runs via `manage.py db_worker`.
TASKS = {
    "default": {
        "BACKEND": "django_tasks_db.backend.DatabaseBackend",
    },
}

# --- Auth ----------------------------------------------------------------

AUTH_USER_MODEL = "accounts.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]
# Password hashing: bcrypt (TSD §3.3, cost 12).
PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.BCryptSHA256PasswordHasher",
    "django.contrib.auth.hashers.PBKDF2PasswordHasher",
]

# --- Internationalisation ------------------------------------------------

LANGUAGE_CODE = "en-us"
TIME_ZONE = "Africa/Lagos"
USE_I18N = True
USE_TZ = True

# --- Static & media ------------------------------------------------------

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

# Private verification documents land in R2 (or MEDIA_ROOT/private in dev).
# They are NEVER served from STATIC_URL or a public bucket — access is via
# short-lived presigned GETs (R2) or an Ops-only stream view (local).
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# --- Cache (login-failure lockout counter) -------------------------------
# LocMemCache is per-process: fine for dev/CI. PROD multi-worker needs a
# shared cache for the IP lockout to hold across gunicorn workers — use the
# DB cache backend (no Redis, respects D-010) before launch.
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        "LOCATION": "terminal-default",
    },
}

# --- DRF -----------------------------------------------------------------

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        # Subclasses simplejwt's JWTAuthentication to also reject tokens whose
        # `tv` (token_version) claim is stale — the lever that invalidates all
        # outstanding access tokens on logout-all / password-reset-confirm.
        "accounts.authentication.TerminalJWTAuthentication",
    ),
    "DEFAULT_PAGINATION_CLASS": "core.pagination.TerminalCursorPagination",
    "PAGE_SIZE": 20,
    "EXCEPTION_HANDLER": "core.exceptions.terminal_exception_handler",
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_THROTTLE_CLASSES": ("rest_framework.throttling.ScopedRateThrottle",),
    # Throttle rates per TSD §3.8. Defined now; views opt in via throttle_scope.
    "DEFAULT_THROTTLE_RATES": {
        "search_anon": "60/min",
        "auth": "120/min",
        "otp_send": "3/hour",
        "login": "5/min",
        "report": "5/day",
    },
}

SIMPLE_JWT = {
    # FSD §4.2: access 60 min, refresh 7 days rotating, blacklist on logout.
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=60),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    # Login mints tokens with our custom claims (user_id, role flags, tv).
    "TOKEN_OBTAIN_SERIALIZER": "accounts.services.tokens.TerminalTokenObtainPairSerializer",
}

SPECTACULAR_SETTINGS = {
    "TITLE": "Terminal API",
    "DESCRIPTION": "Map-first B2B marketplace for hiring heavy assets in Nigeria.",
    "VERSION": "v1",
    "SERVE_INCLUDE_SCHEMA": False,
    "SCHEMA_PATH_PREFIX": "/api/v1",
}

# --- Integration keys (absent in dev => console/log fallback, never crash) ---
# Commandment 10: simulate integrations, never simulate trust.

FIELD_ENCRYPTION_KEY = env("FIELD_ENCRYPTION_KEY", default="")

R2_ACCOUNT_ID = env("R2_ACCOUNT_ID", default="")
R2_ACCESS_KEY_ID = env("R2_ACCESS_KEY_ID", default="")
R2_SECRET = env("R2_SECRET", default="")
R2_PUBLIC_BUCKET = env("R2_PUBLIC_BUCKET", default="")
R2_PRIVATE_BUCKET = env("R2_PRIVATE_BUCKET", default="")
R2_PUBLIC_BASE_URL = env("R2_PUBLIC_BASE_URL", default="")

# R2 is S3-compatible; the endpoint is derived from the account id.
R2_ENDPOINT_URL = f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com" if R2_ACCOUNT_ID else ""
# Presigned-GET lifetime for private docs (TSD §3.9: 15 min).
R2_PRESIGN_TTL = 15 * 60
# "r2" when credentials are present, else a local-disk fallback (dev/CI).
PRIVATE_MEDIA_BACKEND = "r2" if (R2_ACCOUNT_ID and R2_PRIVATE_BUCKET) else "local"

# Transactional email (Resend in prod; Mailpit/console in dev). Sender is the
# verified Terminal domain in prod.
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", default="Terminal <contact@perblis.com>")

# Base URL of the user-facing app, used to build links in emails (e.g. the
# password-reset link). The Supplier Portal (Wave 7) lives here.
FRONTEND_BASE_URL = env("FRONTEND_BASE_URL", default="http://localhost:3000")

# Payments: Bachs.io, collect-only (D-017, supersedes Paystack in D-006).
# Keys absent in dev => degraded, never crash. Integration lands in Wave 4.
BACHS_API_BASE = env("BACHS_API_BASE", default="https://sandbox-api.bachs.io/v1")
BACHS_SECRET_KEY = env("BACHS_SECRET_KEY", default="")
BACHS_WEBHOOK_SECRET = env("BACHS_WEBHOOK_SECRET", default="")

ABLY_API_KEY = env("ABLY_API_KEY", default="")
TERMII_API_KEY = env("TERMII_API_KEY", default="")
TERMII_SENDER_ID = env("TERMII_SENDER_ID", default="")
RESEND_API_KEY = env("RESEND_API_KEY", default="")
LOCATIONIQ_KEY = env("LOCATIONIQ_KEY", default="")

# --- Sentry (no-op without DSN) ------------------------------------------

SENTRY_DSN = env("SENTRY_DSN", default="")
SENTRY_ENVIRONMENT = env("SENTRY_ENVIRONMENT", default="local")
if SENTRY_DSN:
    import sentry_sdk

    sentry_sdk.init(
        dsn=SENTRY_DSN,
        environment=SENTRY_ENVIRONMENT,
        traces_sample_rate=0.0,
        send_default_pii=False,
    )

# --- Logging (structlog JSON) --------------------------------------------

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "json": {
            "()": structlog.stdlib.ProcessorFormatter,
            "processor": structlog.processors.JSONRenderer(),
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "json",
        },
    },
    "root": {"handlers": ["console"], "level": "INFO"},
}

structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
    ],
    logger_factory=structlog.stdlib.LoggerFactory(),
    wrapper_class=structlog.stdlib.BoundLogger,
    cache_logger_on_first_use=True,
)
