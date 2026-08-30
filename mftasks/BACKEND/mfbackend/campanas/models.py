from django.conf import settings
from django.db import models
from django.db.models import Q, CheckConstraint, UniqueConstraint


class Campana(models.Model):
    cliente = models.ForeignKey(
        "clientes.Cliente",
        on_delete=models.PROTECT,
        related_name="campanas",
    )
    nombre = models.CharField(max_length=100)
    codigo = models.CharField(max_length=30, unique=True, blank=True)
    activo = models.BooleanField(default=True)
    fecha_creacion = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("cliente", "nombre")
        indexes = [
            models.Index(fields=["cliente", "activo"]),
        ]

    def __str__(self):
        return f"{self.cliente.nombre} - {self.nombre}"

    def save(self, *args, **kwargs):
        if not self.codigo:
            # generar codigo slug-like
            base = f"{self.cliente.nombre[:10]}_{self.nombre[:10]}".upper().replace(" ", "_")
            self.codigo = base[:30]
        super().save(*args, **kwargs)


class SubCampana(models.Model):
    campana = models.ForeignKey(
        Campana,
        on_delete=models.CASCADE,
        related_name="subcampanas",
    )
    nombre = models.CharField(max_length=100)
    codigo = models.CharField(max_length=40, unique=True, blank=True)
    activo = models.BooleanField(default=True)
    fecha_creacion = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("campana", "nombre")
        indexes = [
            models.Index(fields=["campana", "activo"]),
        ]

    def __str__(self):
        return f"{self.campana} / {self.nombre}"

    def save(self, *args, **kwargs):
        if not self.codigo:
            base = f"{self.campana.codigo}_{self.nombre[:15]}".upper().replace(" ", "_")
            self.codigo = base[:40]
        super().save(*args, **kwargs)


class PermisoCampana(models.Model):
    """
    Permiso mixto: permite acceso a nivel Campana (todas sus subcampanas)
    o a nivel SubCampana puntual.
    Exactamente uno de (campana, subcampana) debe ser no-nulo.
    """
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="permisos_campana",
    )
    campana = models.ForeignKey(
        Campana,
        on_delete=models.CASCADE,
        related_name="permisos",
        null=True,
        blank=True,
    )
    subcampana = models.ForeignKey(
        SubCampana,
        on_delete=models.CASCADE,
        related_name="permisos",
        null=True,
        blank=True,
    )
    fecha_otorgado = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            CheckConstraint(
                check=(Q(campana__isnull=False, subcampana__isnull=True) | Q(campana__isnull=True, subcampana__isnull=False)),
                name="chk_permiso_xor",
            ),
            UniqueConstraint(fields=["usuario", "campana"], condition=Q(campana__isnull=False), name="uniq_permiso_usuario_campana"),
            UniqueConstraint(fields=["usuario", "subcampana"], condition=Q(subcampana__isnull=False), name="uniq_permiso_usuario_subcampana"),
        ]
        indexes = [
            models.Index(fields=["usuario"]),
        ]

    def __str__(self):
        if self.subcampana_id:
            return f"{self.usuario} -> {self.subcampana}"
        return f"{self.usuario} -> {self.campana} (todas)"

    def clean(self):
        from django.core.exceptions import ValidationError
        if (self.campana_id is None) == (self.subcampana_id is None):
            raise ValidationError("Debe indicar campana o subcampana, no ambos ni ninguno.")
