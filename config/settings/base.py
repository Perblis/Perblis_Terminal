import environ
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent

env = environ.Env(
    DEBUG=(bool, False),
)

environ.Env.read_env(BASE_DIR / '.env')

SECRET_KEY = env('SECRET_KEY')
DEBUG = env('DEBUG')
ALLOWED_HOSTS = env.list('ALLOWED_HOSTS', default=[])

DJANGO_APPS = [
    'unfold',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'django.contrib.gis',
]

THIRD_PARTY_APPS = [
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'corsheaders',
    'django_filters',
    'drf_spectacular',
    'django_q',
    'storages',
]

LOCAL_APPS = [
    'core',
    'accounts',
    'listings',
    'search',
    'bookings',
    'messaging',
    'owner',
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

# Django Unfold Admin configuration
UNFOLD = {
    "SITE_TITLE": "Terminal Admin",
    "SITE_HEADER": "Terminal",
    "SITE_SUBHEADER": "Heavy Asset Leasing Platform",
    "SITE_URL": "/",
    "SHOW_HISTORY": True,
    "SHOW_VIEW_ON_SITE": False,
    "DASHBOARD_CALLBACK": "core.admin_dashboard.dashboard_callback",
    "COLORS": {
        "primary": {
            "50": "240 249 255",
            "100": "224 242 254",
            "200": "186 230 253",
            "300": "125 211 252",
            "400": "56 189 248",
            "500": "14 165 233",
            "600": "2 132 199",
            "700": "3 105 161",
            "800": "7 89 133",
            "900": "12 74 110",
            "950": "8 47 73",
        },
    },
    "TABS": [
        {
            "models": ["accounts.user"],
            "items": [
                {"title": "All Users", "link": "/admin/accounts/user/"},
                {"title": "Documents", "link": "/admin/accounts/userdocument/"},
            ],
        },
        {
            "models": ["listings.listing"],
            "items": [
                {"title": "All Listings", "link": "/admin/listings/listing/"},
                {"title": "Reports", "link": "/admin/listings/listingreport/"},
            ],
        },
        {
            "models": ["bookings.booking"],
            "items": [
                {"title": "All Bookings", "link": "/admin/bookings/booking/"},
            ],
        },
        {
            "models": ["messaging.thread"],
            "items": [
                {"title": "Threads", "link": "/admin/messaging/thread/"},
            ],
        },
    ],
}

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

AUTH_USER_MODEL = 'accounts.User'

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'Africa/Lagos'
USE_I18N = True
USE_TZ = True

STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# REST Framework
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_FILTER_BACKENDS': (
        'django_filters.rest_framework.DjangoFilterBackend',
    ),
    'DEFAULT_PAGINATION_CLASS': 'core.pagination.StandardPagination',
    'PAGE_SIZE': 20,
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
    'EXCEPTION_HANDLER': 'core.exceptions.custom_exception_handler',
    'DEFAULT_THROTTLE_CLASSES': [],
    'DEFAULT_THROTTLE_RATES': {
        'auth_login': '5/min',
        'auth_register': '5/hour',
        'auth_password_reset': '3/hour',
    },
}

# JWT
from datetime import timedelta
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(days=7),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=30),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'AUTH_HEADER_TYPES': ('Bearer',),
    'TOKEN_OBTAIN_SERIALIZER': 'accounts.serializers.CustomTokenObtainPairSerializer',
}

# DRF Spectacular
SPECTACULAR_SETTINGS = {
    'TITLE': 'Terminal API',
    'DESCRIPTION': 'Heavy asset leasing marketplace API',
    'VERSION': '1.0.0',
    'SERVE_INCLUDE_SCHEMA': False,
}

# CORS
CORS_ALLOWED_ORIGINS = env.list('CORS_ALLOWED_ORIGINS', default=[])
CORS_ALLOW_ALL_ORIGINS = env.bool('CORS_ALLOW_ALL_ORIGINS', default=False)

# Storage - Cloudflare R2 (S3-compatible)
AWS_ACCESS_KEY_ID = env('R2_ACCESS_KEY_ID', default='')
AWS_SECRET_ACCESS_KEY = env('R2_SECRET_ACCESS_KEY', default='')
AWS_STORAGE_BUCKET_NAME = env('R2_BUCKET_NAME', default='terminal-uploads').lower()
AWS_S3_ENDPOINT_URL = env('R2_ENDPOINT_URL', default='')
AWS_S3_CUSTOM_DOMAIN = env('R2_CUSTOM_DOMAIN', default='')
AWS_DEFAULT_ACL = 'public-read'
AWS_S3_OBJECT_PARAMETERS = {'CacheControl': 'max-age=86400'}
AWS_QUERYSTRING_AUTH = False

# Django Q
Q_CLUSTER = {
    'name': 'terminal',
    'workers': 2,
    'recycle': 500,
    'timeout': 60,
    'compress': True,
    'save_limit': 250,
    'queue_limit': 500,
    'cpu_affinity': 1,
    'label': 'Django Q',
    'orm': 'default',
}

# Ably
ABLY_API_KEY = env('ABLY_API_KEY', default='')

# Mapbox
MAPBOX_ACCESS_TOKEN = env('MAPBOX_ACCESS_TOKEN', default='')
