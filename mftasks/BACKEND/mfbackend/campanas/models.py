from django.conf import settings
from django.db import models
from django.db.models import Q, CheckConstraint, UniqueConstraint


class Campana(models.Model):
    entidad = models.ForeignKey(
        "clientes.Entidad",
        on_delete=models.PROTECT,
        related_name="campanas",
    )
    nombre = models.CharField(max_length=100)
    codigo = models.CharField(max_length=30, blank=True)
    activo = models.BooleanField(default=True)
    eliminado = models.BooleanField(default=False, db_index=True)
    fecha_eliminacion = models.DateTimeField(null=True, blank=True)
    eliminado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="campanas_eliminadas",
    )
    fecha_creacion = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            UniqueConstraint(
                fields=["entidad", "nombre"],
                condition=Q(eliminado=False),
                name="uniq_campana_entidad_nombre_activo",
            ),
            UniqueConstraint(
                fields=["codigo"],
                condition=Q(eliminado=False),
                name="uniq_campana_codigo_activo",
            ),
        ]
        indexes = [
            models.Index(fields=["activo"]),
            models.Index(
                fields=["entidad", "activo"],
                name="campanas_entidad_activo_idx",
            ),
        ]

    def __str__(self):
        return f"{self.entidad} / {self.nombre}"

    def save(self, *args, **kwargs):
        if not self.entidad_id:
            from clientes.models import Entidad

            entidad = Entidad.objects.filter(
                nombre=self.nombre,
                eliminado=False,
            ).first()
            if entidad is None:
                entidad = Entidad.objects.create(
                    nombre=self.nombre,
                    razon_social=self.nombre,
                )
            self.entidad = entidad

        if not self.codigo:
            base = f"{self.nombre[:15]}".upper().replace(" ", "_")
            self.codigo = base[:30]

        super().save(*args, **kwargs)


class SubCampana(models.Model):
    campana = models.ForeignKey(
        Campana,
        on_delete=models.CASCADE,
        related_name="subcampanas",
    )
    nombre = models.CharField(max_length=100)
    codigo = models.CharField(max_length=40, blank=True)
    activo = models.BooleanField(default=True)
    eliminado = models.BooleanField(default=False, db_index=True)
    fecha_eliminacion = models.DateTimeField(null=True, blank=True)
    eliminado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="subcampanas_eliminadas",
    )
    fecha_creacion = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            UniqueConstraint(
                fields=["campana", "nombre"],
                condition=Q(eliminado=False),
                name="uniq_subcampana_campana_nombre_activo",
            ),
            UniqueConstraint(
                fields=["codigo"],
                condition=Q(eliminado=False),
                name="uniq_subcampana_codigo_activo",
            ),
        ]
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
