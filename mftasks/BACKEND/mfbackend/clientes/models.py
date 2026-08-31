from django.db import models


class Cliente(models.Model):

    nombre = models.CharField(
        max_length=150,
        unique=True
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

    fecha_creacion = models.DateTimeField(
        auto_now_add=True
    )

    def __str__(self):
        return self.nombre