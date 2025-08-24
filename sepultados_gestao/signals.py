# signals.py
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from .models import Sepultado, Tumulo

def _touch_tumulo(tumulo_id):
    if tumulo_id:
        t = Tumulo.objects.filter(pk=tumulo_id).first()
        if t:
            t.atualizar_status()

@receiver(post_save, sender=Sepultado)
def sepultado_saved(sender, instance, **kwargs):
    _touch_tumulo(getattr(instance, "tumulo_id", None))

@receiver(post_delete, sender=Sepultado)
def sepultado_deleted(sender, instance, **kwargs):
    _touch_tumulo(getattr(instance, "tumulo_id", None))

# --- imports para os sinais de Exumacao ---
from .models import Exumacao
from .services.arquivamento import sync_sepultado_status

@receiver(post_save, sender=Exumacao)
def exumacao_saved(sender, instance, **kwargs):
    # mantém o campo exumado/status do sepultado coerente
    sep = getattr(instance, "sepultado", None)
    sync_sepultado_status(sep)
    # atualiza o status do túmulo para refletir na listagem
    _touch_tumulo(getattr(sep, "tumulo_id", None) if sep else None)

@receiver(post_delete, sender=Exumacao)
def exumacao_deleted(sender, instance, **kwargs):
    sep = getattr(instance, "sepultado", None)
    sync_sepultado_status(sep)
    _touch_tumulo(getattr(sep, "tumulo_id", None) if sep else None)
