from django.apps import AppConfig

class SepultadosGestaoConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'sepultados_gestao'
    verbose_name = "Sepultados Gestão"

    def ready(self):
        # garante o registro dos signals
        from . import signals  # noqa
