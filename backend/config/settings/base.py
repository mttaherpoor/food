import os
from pathlib import Path

from config.env import get_csv, get_secret

BASE_DIR = Path(__file__).resolve().parents[2]
REPOSITORY_DIR = BASE_DIR.parent

SECRET_KEY = get_secret(
    'DJANGO_SECRET_KEY',
    default_file=REPOSITORY_DIR / 'secrets' / 'django_secret_key.txt',
)

DEBUG = False
ALLOWED_HOSTS = get_csv('DJANGO_ALLOWED_HOSTS', default='localhost,127.0.0.1')
CSRF_TRUSTED_ORIGINS = get_csv('DJANGO_CSRF_TRUSTED_ORIGINS')

INSTALLED_APPS = [
    'unfold',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # 3rd party apps
    'rest_framework',
    'drf_spectacular',

    # local apps
    'core',
    'food',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
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
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'
ASGI_APPLICATION = 'config.asgi.application'

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.getenv('POSTGRES_DB', 'food_reservation'),
        'USER': os.getenv('POSTGRES_USER', 'food_reservation'),
        'PASSWORD': get_secret(
            'POSTGRES_PASSWORD',
            default_file=REPOSITORY_DIR / 'secrets' / 'postgres_password.txt',
        ),
        'HOST': os.getenv('POSTGRES_HOST', 'localhost'),
        'PORT': os.getenv('POSTGRES_PORT', '5432'),
        'CONN_MAX_AGE': 60,
        'CONN_HEALTH_CHECKS': True,
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'fa-ir'
TIME_ZONE = 'Asia/Tehran'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'
STATICFILES_DIRS = [ BASE_DIR / "static",]
STATIC_ROOT = BASE_DIR / 'staticfiles'

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
AUTH_USER_MODEL = 'core.CustomUser'

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.SessionAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
        'core.permissions.HasChangedInitialPassword',
    ],
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
}

SPECTACULAR_SETTINGS = {
    'TITLE': 'Food Reservation API',
    'DESCRIPTION': 'API for employee food reservations and food management.',
    'VERSION': '0.1.0',
    'SERVE_INCLUDE_SCHEMA': False,
}

UNFOLD = {
    'SITE_TITLE': 'سامانه رزرو غذا',
    'SITE_HEADER': 'مدیریت سامانه رزرو غذا',
    'SITE_SYMBOL': 'restaurant',
}
