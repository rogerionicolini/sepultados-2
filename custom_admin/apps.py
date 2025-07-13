from django.apps import AppConfig
from django.apps import apps

class CustomAdminConfig(AppConfig):
    name = 'custom_admin'

    def ready(self):
        try:
            apps.get_app_config('auth').verbose_name = "Administração Geral"
            apps.get_app_config('sepultados_gestao').verbose_name = "Sepultados Gestão"
        except LookupError:
            pass
