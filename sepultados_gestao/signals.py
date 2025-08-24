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
