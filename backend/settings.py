import os
from pathlib import Path
from corsheaders.defaults import default_headers

BASE_DIR = Path(__file__).resolve().parent.parent

# —————————————————— Básico ——————————————————
SECRET_KEY = 'sua-chave-secreta-aqui'
DEBUG = True
ALLOWED_HOSTS = ["127.0.0.1", "localhost"]

# —————————————————— Apps ——————————————————
INSTALLED_APPS = [
    # Seus apps
    'aaa_usuarios.apps.AaaUsuariosConfig',
    'sepultados_gestao.apps.SepultadosGestaoConfig',
    'core',
    'relatorios',
    # Terceiros
    'crum',
    'corsheaders',
    'rest_framework',
    'rest_framework_simplejwt',
    'django.contrib.humanize',
    # Django
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    # Admin customizado
    'custom_admin.apps.CustomAdminConfig',
]

# —————————————————— Middleware (ordem IMPORTA) ——————————————————
MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',               # 1) CORS no topo
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',# 2) Sessão
    'django.middleware.locale.LocaleMiddleware',           # 3) Locale (depois de Session)
    'django.middleware.common.CommonMiddleware',           # 4) Common
    'django.middleware.csrf.CsrfViewMiddleware',           # 5) CSRF
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'crum.CurrentRequestUserMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'sepultados_gestao.middleware.PrefeituraAtivaMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'backend.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [os.path.join(BASE_DIR, 'custom_admin', 'templates')],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
                'sepultados_gestao.context_processors.prefeitura_context',
                'sepultados_gestao.context_processors.licenca_ativa_context',
            ],
        },
    },
]

WSGI_APPLICATION = 'backend.wsgi.application'

# —————————————————— Banco ——————————————————
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}

# —————————————————— DRF / JWT ——————————————————
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
        "rest_framework.authentication.SessionAuthentication",
    )
}


# —————————————————— Senhas ——————————————————
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# —————————————————— Locale / Timezone ——————————————————
LANGUAGE_CODE = 'pt-br'
TIME_ZONE = 'America/Sao_Paulo'
USE_I18N = True
USE_TZ = True

# —————————————————— Static / Media ——————————————————
STATIC_URL = '/static/'
STATICFILES_DIRS = [os.path.join(BASE_DIR, 'custom_admin', 'static')]
STATIC_ROOT = BASE_DIR / "staticfiles"

MEDIA_URL = '/media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
LOGIN_REDIRECT_URL = '/admin/'
AUTH_USER_MODEL = 'aaa_usuarios.Usuario'

# —————————————————— E-mail (mova p/ .env em produção) ——————————————————
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = 'smtp.hostinger.com'
EMAIL_PORT = 465
EMAIL_HOST_USER = 'suporte@sepultados.com'
EMAIL_HOST_PASSWORD = 'Digital15suporte%'   # coloque em variável de ambiente em prod
EMAIL_USE_SSL = True
EMAIL_USE_TLS = False
DEFAULT_FROM_EMAIL = 'Sepultados.com <suporte@sepultados.com>'

FRONTEND_URL = 'http://127.0.0.1:5173'  # mantenha o mesmo host usado no navegador

# —————————————————— CORS/CSRF (LOCAL) ——————————————————
# Use SEMPRE o mesmo host (127.0.0.1 ou localhost) no front e no back
CORS_ALLOWED_ORIGINS = [
    "http://127.0.0.1:5173",
    "http://localhost:5173",
]
CORS_ALLOW_CREDENTIALS = True  # vamos mandar cookie de sessão/CSRF nas requisições do app

CORS_ALLOW_HEADERS = list(default_headers) + [
    "authorization",
    "content-type",
    "x-csrftoken",
]
CORS_EXPOSE_HEADERS = ["Content-Disposition"]  # útil para downloads

CSRF_TRUSTED_ORIGINS = [
    "http://127.0.0.1:5173",
    "http://localhost:5173",
]

# Cookies em DEV (HTTP)
SESSION_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SAMESITE = "Lax"
SESSION_COOKIE_SECURE = False
CSRF_COOKIE_SECURE = False

# —————————————————— Proxy/HTTPS (deixe para produção) ——————————————————
# SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
