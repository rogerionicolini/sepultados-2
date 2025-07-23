from django.apps import AppConfig

class SepultadosGestaoConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'sepultados_gestao'
    verbose_name = "Sepultados Gestão"

    def ready(self):
        import sepultados_gestao.models  # se os sinais estão no models.py
        # ou:
        # import sepultados_gestao.signals  # se mover os sinais para signals.py
