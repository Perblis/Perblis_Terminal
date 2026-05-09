"""
Minimal settings for build-time commands (collectstatic).

Uses SQLite to avoid loading the PostGIS backend. Also locates
GDAL/GEOS libraries in the Nix store since they aren't on
LD_LIBRARY_PATH during Docker build steps.
"""
import glob

from .base import *

DEBUG = False
ALLOWED_HOSTS = ['*']

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': ':memory:',
    }
}

_gdal = glob.glob('/nix/store/*/lib/libgdal.so')
if _gdal:
    GDAL_LIBRARY_PATH = _gdal[0]

_geos = glob.glob('/nix/store/*/lib/libgeos_c.so')
if _geos:
    GEOS_LIBRARY_PATH = _geos[0]
