from django.conf import settings
from django.db import models
from django.db.models import Q, UniqueConstraint


class Entidad(models.Model):

    nombre = models.CharField(
        max_length=150
    )

    razon_social = models.CharField(
        max_length=200,
        blank=True
    )

    ruc = models.CharField(
        max_length=20,
        unique=True,
        blank=True,
        null=True
    )

    correo = models.EmailField(
        blank=True
    )

    telefono = models.CharField(
        max_length=20,
        blank=True
    )

    direccion = models.CharField(
        max_length=255,
        blank=True
    )

    activo = models.BooleanField(
        default=True
    )

    eliminado = models.BooleanField(
        default=False,
        db_index=True
    )

    fecha_eliminacion = models.DateTimeField(
        null=True,
        blank=True
    )

    eliminado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="entidades_eliminadas",
    )

    fecha_creacion = models.DateTimeField(
        auto_now_add=True
    )

    class Meta:
        constraints = [
            UniqueConstraint(
                fields=["nombre"],
                condition=Q(eliminado=False),
                name="uniq_entidad_nombre_activo",
            ),
        ]

    def __str__(self):
        return self.nombre