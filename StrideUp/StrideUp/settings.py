"""
Django settings for StrideUp project.
"""

from pathlib import Path
from datetime import timedelta
import os

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# =============================================================================
# GDAL/GEOS Configuration for Windows - ADD THIS AT THE TOP
# =============================================================================
if os.name == 'nt':  # Windows
    OSGEO4W = r'C:\OSGeo4W'
    if os.path.isdir(OSGEO4W):
        os.environ['OSGEO4W_ROOT'] = OSGEO4W
        os.environ['GDAL_DATA'] = os.path.join(OSGEO4W, 'share', 'gdal')
        os.environ['PROJ_LIB'] = os.path.join(OSGEO4W, 'share', 'proj')
        os.environ['PATH'] = os.path.join(OSGEO4W, 'bin') + ';' + os.environ['PATH']
        
        # Find and set GDAL library path
        gdal_bin = os.path.join(OSGEO4W, 'bin')
        if os.path.isdir(gdal_bin):
            # Find the GDAL DLL
            for filename in os.listdir(gdal_bin):
                if filename.startswith('gdal') and filename.endswith('.dll'):
                    if filename[4:7].isdigit():  # e.g., gdal309.dll
                        GDAL_LIBRARY_PATH = os.path.join(gdal_bin, filename)
                        break
            
            # Find the GEOS DLL
            for filename in os.listdir(gdal_bin):
                if filename.startswith('geos_c') and filename.endswith('.dll'):
                    GEOS_LIBRARY_PATH = os.path.join(gdal_bin, filename)
                    break


# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = "django-insecure-7m&=mh%+=$2ey4$bojvqh36j8k*gm$js0p_@1x$!5ix36x23^p"

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = True

ALLOWED_HOSTS = ['127.0.0.1', 'localhost', '192.168.1.64', '*']


# Application definition
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.gis",
    "rest_framework",
    "rest_framework_gis",
    "leaflet",
    "Users",
    "activities",
    "djoser",
    "corsheaders",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "StrideUp.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "StrideUp.wsgi.application"


# =============================================================================
# DATABASE CONFIGURATION - PostgreSQL with PostGIS
# =============================================================================
DATABASES = {
    "default": {
        "ENGINE": "django.contrib.gis.db.backends.postgis",
        "NAME": "strideup_database",
        "USER": "strideup_users",
        "PASSWORD": "StrideUp@2025",
        "HOST": "localhost",
        "PORT": "5432",
    }
}


# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",
    },
]


# Internationalization
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True


# Static files (CSS, JavaScript, Images)
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

# Default primary key field type
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Custom User Model
AUTH_USER_MODEL = "Users.User"

# Django REST Framework
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
}

# Simple JWT Settings
SIMPLE_JWT = {
    'AUTH_HEADER_TYPES': ('JWT',),
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=60),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=1),
}

# CORS Settings
CORS_ALLOW_ALL_ORIGINS = True

# Djoser Settings
DJOSER = {
    'USER_CREATE_PASSWORD_RETYPE': False,
    'SEND_ACTIVATION_EMAIL': False,
    'SERIALIZERS': {
        'user_create': 'Users.serializers.UserCreateSerializer',
        'user': 'Users.serializers.UserSerializer',
        'current_user': 'Users.serializers.UserSerializer',
    },
    'LOGIN_FIELD': 'username',
}

# Leaflet Configuration
LEAFLET_CONFIG = {
    'DEFAULT_CENTER': (27.7172, 85.3240),
    'DEFAULT_ZOOM': 13,
    'MIN_ZOOM': 3,
    'MAX_ZOOM': 19,
    'SCALE': 'both',
    'ATTRIBUTION_PREFIX': 'StrideUp',
}