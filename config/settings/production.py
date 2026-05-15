import glob

from django.conf import global_settings as _django_global_settings

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
# Env vars use the R2_* naming from the Railway R2 plugin, then map to the
# AWS_* settings django-storages actually reads:
#   R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY  R2 API token credentials
#   R2_BUCKET                               R2 bucket name
#   R2_ENDPOINT                             https://<account>.r2.cloudflarestorage.com
#   R2_PUBLIC_URL                           public host serving the bucket
#                                           (r2.dev subdomain or custom CDN domain).
# Without R2_PUBLIC_URL, file.url returns a bare 'listings/...' path that
# browsers resolve site-relative -> 404 on the Django host.
_required_r2_env = (
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
    'R2_BUCKET',
    'R2_ENDPOINT',
    'R2_PUBLIC_URL',
)
_missing_r2_env = [name for name in _required_r2_env if not env(name, default='')]
if _missing_r2_env:
    raise RuntimeError(
        'Cloudflare R2 storage is misconfigured. Missing env vars: '
        + ', '.join(_missing_r2_env)
        + '. Set them in Railway so file.url returns absolute R2 URLs; '
          'otherwise listing images 404 against the Django host.'
    )


def _strip_scheme(url: str) -> str:
    """AWS_S3_CUSTOM_DOMAIN must be host[:port][/path] without scheme."""
    for prefix in ('https://', 'http://'):
        if url.startswith(prefix):
            return url[len(prefix):].rstrip('/')
    return url.rstrip('/')


_DEFAULT_MEDIA_BACKEND = 'storages.backends.s3boto3.S3Boto3Storage'
# Kept for third-party code that still reads this setting; Django 5.2+ uses STORAGES.
DEFAULT_FILE_STORAGE = _DEFAULT_MEDIA_BACKEND
AWS_S3_SIGNATURE_VERSION = 's3v4'
AWS_S3_REGION_NAME = 'auto'
AWS_S3_FILE_OVERWRITE = False
AWS_ACCESS_KEY_ID = env('R2_ACCESS_KEY_ID')
AWS_SECRET_ACCESS_KEY = env('R2_SECRET_ACCESS_KEY')
AWS_STORAGE_BUCKET_NAME = env('R2_BUCKET').strip().lower()
AWS_S3_ENDPOINT_URL = env('R2_ENDPOINT').strip()
AWS_S3_CUSTOM_DOMAIN = _strip_scheme(env('R2_PUBLIC_URL').strip())
AWS_QUERYSTRING_AUTH = env.bool('AWS_QUERYSTRING_AUTH', default=False)
# base.py sets public-read; R2 buckets typically disallow object ACLs (PutObject
# fails with AccessDenied / 400 unless the token includes s3:PutObjectAcl).
# Public reads come from the bucket / r2.dev public access policy, not per-object ACL.
AWS_DEFAULT_ACL = None

STORAGES = {
    **_django_global_settings.STORAGES,
    'default': {'BACKEND': _DEFAULT_MEDIA_BACKEND},
}

# ── CORS (mobile app + web frontend) ──────────────────────────────────
# Browsers cannot use Access-Control-Allow-Origin: * together with credentialed
# requests (Authorization header, cookies). django-cors-headers therefore
# requires explicit origins when CORS_ALLOW_CREDENTIALS is True — setting only
# CORS_ALLOW_ALL_ORIGINS=True in Railway will still produce "blocked by CORS"
# for owner-web on a different host than the API.
CORS_ALLOW_CREDENTIALS = True

_cors_origins = list(env.list('CORS_ALLOWED_ORIGINS', default=[]))
_owner_web = (env('OWNER_WEB_URL', default='') or '').strip().rstrip('/')
if _owner_web and _owner_web not in _cors_origins:
    _cors_origins.append(_owner_web)

CORS_ALLOWED_ORIGINS = _cors_origins
# Wildcard origins are incompatible with CORS_ALLOW_CREDENTIALS=True (see above).
CORS_ALLOW_ALL_ORIGINS = False

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
