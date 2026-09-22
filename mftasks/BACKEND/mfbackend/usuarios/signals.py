from django.conf import settings
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import PreferenciaNotificacion


@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def crear_preferencias_notificacion(sender, instance, created, **kwargs):
    """
    Crea las preferencias de notificación cuando se crea un usuario.
    """
    if created:
        PreferenciaNotificacion.objects.get_or_create(
            usuario=instance,
        )