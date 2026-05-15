from django.conf import global_settings as _django_global_settings

from .base import *

DEBUG = True
ALLOWED_HOSTS = ['*']
CORS_ALLOW_ALL_ORIGINS = True

DATABASES = {
    'default': {
        'ENGINE': 'django.contrib.gis.db.backends.postgis',
        'NAME': env('DB_NAME', default='terminal_dev'),
        'USER': env('DB_USER', default='postgres'),
        'PASSWORD': env('DB_PASSWORD', default='postgres'),
        'HOST': env('DB_HOST', default='localhost'),
        'PORT': env('DB_PORT', default='5432'),
    }
}

DEFAULT_FILE_STORAGE = 'django.core.files.storage.FileSystemStorage'
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# Django 5.2+ uses STORAGES for FileField/default_storage; keep both in sync.
STORAGES = {
    **_django_global_settings.STORAGES,
    'default': {'BACKEND': DEFAULT_FILE_STORAGE},
}

EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'

import sentry_sdk
_sentry_dsn = env('SENTRY_DSN', default='')
if _sentry_dsn:
    sentry_sdk.init(dsn=_sentry_dsn, traces_sample_rate=0.0)
