import glob

from .base import *

DEBUG = False
ALLOWED_HOSTS = env.list('ALLOWED_HOSTS')

if env('DATABASE_URL', default=''):
    DATABASES = {
        'default': env.db_url('DATABASE_URL', engine='django.contrib.gis.db.backends.postgis'),
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.contrib.gis.db.backends.postgis',
            'NAME': env('DB_NAME'),
            'USER': env('DB_USER'),
            'PASSWORD': env('DB_PASSWORD'),
            'HOST': env('DB_HOST'),
            'PORT': env('DB_PORT', default='5432'),
        }
    }

_gdal = glob.glob('/nix/store/*/lib/libgdal.so')
if _gdal:
    GDAL_LIBRARY_PATH = _gdal[0]

_geos = glob.glob('/nix/store/*/lib/libgeos_c.so')
if _geos:
    GEOS_LIBRARY_PATH = _geos[0]

# ── Static files (whitenoise) ──────────────────────────────────────────
MIDDLEWARE.insert(1, 'whitenoise.middleware.WhiteNoiseMiddleware')
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

# ── File uploads (Cloudflare R2 — S3-compatible) ───────────────────────
DEFAULT_FILE_STORAGE = 'storages.backends.s3boto3.S3Boto3Storage'
AWS_S3_SIGNATURE_VERSION = 's3v4'
AWS_S3_REGION_NAME = 'auto'
AWS_S3_FILE_OVERWRITE = False

# ── CORS (mobile app + web frontend) ──────────────────────────────────
CORS_ALLOW_ALL_ORIGINS = env.bool('CORS_ALLOW_ALL_ORIGINS', default=False)
CORS_ALLOWED_ORIGINS = env.list('CORS_ALLOWED_ORIGINS', default=[])
CORS_ALLOW_CREDENTIALS = True

# ── Sentry (error tracking + performance) ─────────────────────────────
import sentry_sdk

_sentry_dsn = env('SENTRY_DSN', default='')
if _sentry_dsn:
    sentry_sdk.init(
        dsn=_sentry_dsn,
        traces_sample_rate=0.1,
        profiles_sample_rate=0.1,
        send_default_pii=False,
        environment='production',
    )

# ── Security hardening ────────────────────────────────────────────────
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'
SECURE_SSL_REDIRECT = env.bool('SECURE_SSL_REDIRECT', default=True)
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
