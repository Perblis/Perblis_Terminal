"""
Minimal settings for build-time commands (collectstatic).

Uses SQLite to avoid loading the PostGIS backend, which requires
GDAL/GEOS native libraries that may not be on LD_LIBRARY_PATH
during Docker build steps.
"""
from .base import *

DEBUG = False
ALLOWED_HOSTS = ['*']

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': ':memory:',
    }
}
