from django.contrib import admin
from types import MethodType
from django.contrib.auth.models import Group

# Altera o nome exibido no admin, mas mantém a URL original (/admin/auth/group/)
Group._meta.verbose_name = "Tipo de Usuário"
Group._meta.verbose_name_plural = "Tipos de Usuário"


def custom_app_list(self, request, *args, **kwargs):
    app_dict = self._build_app_dict(request)
    ordered_apps = []

    # Função para limpar os títulos (remover o link)
    def clean_app(app, new_label):
        app['name'] = new_label
        app['app_url'] = ''  # Remove o link
        app['models'].sort(key=lambda x: x['name'])
        return app

    # Primeiro grupo: "Usuários e Permissões"
    if 'auth' in app_dict:
        app_auth = app_dict.pop('auth')
        ordered_apps.append(clean_app(app_auth, 'USUÁRIOS E PERMISSÕES'))

    # Segundo grupo: "Sepultados Gestão"
    for key in sorted(app_dict.keys()):
        app = app_dict[key]
        ordered_apps.append(clean_app(app, 'SEPULTADOS GESTÃO'))

    return ordered_apps

admin.site.get_app_list = MethodType(custom_app_list, admin.site)
