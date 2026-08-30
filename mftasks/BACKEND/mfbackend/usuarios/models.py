from django.contrib.auth.models import AbstractUser
from django.db import models
from django.db.models import Q, UniqueConstraint, CheckConstraint
from django.db.models.functions import Lower

from .managers import UserManager


class User(AbstractUser):
    username = None

    email = models.EmailField(unique=True)

    nombres = models.CharField(max_length=150)
    apellidos = models.CharField(max_length=150)

    azure_id = models.CharField(
        max_length=255,
        unique=True,
        null=True,
        blank=True
    )

    cargo = models.CharField(
        max_length=100,
        blank=True
    )

    fecha_creacion = models.DateTimeField(auto_now_add=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    objects = UserManager()

    def __str__(self):
        return f"{self.nombres} {self.apellidos}"


class Rol(models.Model):

    nombre = models.CharField(
        max_length=50,
        unique=True
    )

    descripcion = models.TextField(blank=True)

    activo = models.BooleanField(default=True)

    class Meta:
        constraints = [
            UniqueConstraint(Lower("nombre"), name="rol_nombre_unique_lower"),
        ]

    def __str__(self):
        return self.nombre


class UserRol(models.Model):

    usuario = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="roles"
    )

    rol = models.ForeignKey(
        Rol,
        on_delete=models.CASCADE,
        related_name="usuarios"
    )

    class Meta:
        unique_together = ("usuario", "rol")
        indexes = [
            models.Index(fields=["usuario"]),
            models.Index(fields=["rol"]),
        ]

    def __str__(self):
        return f"{self.usuario} - {self.rol}"


class Equipo(models.Model):

    nombre = models.CharField(
        max_length=100,
        unique=True
    )

    lider = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name="equipos_liderados"
    )

    activo = models.BooleanField(default=True)

    fecha_creacion = models.DateTimeField(
        auto_now_add=True
    )

    def __str__(self):
        return self.nombre

    class Meta:
        indexes = [
            models.Index(fields=["lider"]),
            models.Index(fields=["activo"]),
        ]

    def save(self, *args, **kwargs):
        from django.db import transaction

        is_new = self._state.adding
        old_lider_id = None
        if not is_new:
            try:
                old = Equipo.objects.only("lider_id").get(pk=self.pk)
                old_lider_id = old.lider_id
            except Equipo.DoesNotExist:
                old_lider_id = None
        with transaction.atomic():
            super().save(*args, **kwargs)
            # Sincronizar EquipoMiembro LIDER de forma atómica
            if is_new:
                obj, created = EquipoMiembro.objects.get_or_create(
                    equipo=self,
                    usuario_id=self.lider_id,
                    defaults={"rol_en_equipo": EquipoMiembro.RolEnEquipo.LIDER, "estado": EquipoMiembro.EstadoMiembro.ACTIVO},
                )
                if not created and obj.rol_en_equipo != EquipoMiembro.RolEnEquipo.LIDER:
                    EquipoMiembro.objects.filter(pk=obj.pk).update(rol_en_equipo=EquipoMiembro.RolEnEquipo.LIDER)
            else:
                if old_lider_id and old_lider_id != self.lider_id:
                    EquipoMiembro.objects.filter(equipo=self, usuario_id=old_lider_id, rol_en_equipo=EquipoMiembro.RolEnEquipo.LIDER).update(rol_en_equipo=EquipoMiembro.RolEnEquipo.MIEMBRO)
                    obj, created = EquipoMiembro.objects.get_or_create(
                        equipo=self,
                        usuario_id=self.lider_id,
                        defaults={"rol_en_equipo": EquipoMiembro.RolEnEquipo.LIDER, "estado": EquipoMiembro.EstadoMiembro.ACTIVO},
                    )
                    if not created and obj.rol_en_equipo != EquipoMiembro.RolEnEquipo.LIDER:
                        EquipoMiembro.objects.filter(pk=obj.pk).update(rol_en_equipo=EquipoMiembro.RolEnEquipo.LIDER)


class EquipoMiembro(models.Model):

    class RolEnEquipo(models.TextChoices):
        LIDER = "LIDER", "Líder"
        MIEMBRO = "MIEMBRO", "Miembro"
        SUB_LIDER = "SUB_LIDER", "Sub-líder"

    class EstadoMiembro(models.TextChoices):
        ACTIVO = "ACTIVO", "Activo"
        INACTIVO = "INACTIVO", "Inactivo"
        INDISPONIBLE = "INDISPONIBLE", "Indisponible"

    equipo = models.ForeignKey(
        Equipo,
        on_delete=models.CASCADE,
        related_name="miembros"
    )

    usuario = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="equipos"
    )

    rol_en_equipo = models.CharField(
        max_length=20,
        choices=RolEnEquipo.choices,
        default=RolEnEquipo.MIEMBRO,
    )

    estado = models.CharField(
        max_length=20,
        choices=EstadoMiembro.choices,
        default=EstadoMiembro.ACTIVO,
    )

    fecha_inicio_indisponibilidad = models.DateField(
        null=True, blank=True
    )

    fecha_fin_indisponibilidad = models.DateField(
        null=True, blank=True
    )

    motivo_indisponibilidad = models.CharField(
        max_length=255, blank=True
    )

    fecha_ingreso = models.DateTimeField(
        auto_now_add=True
    )

    # Fase 0: se mantiene SUB_LIDER por compatibilidad, se deprecara en Fase 1
    fecha_baja = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ("equipo", "usuario")
        constraints = [
            UniqueConstraint(
                fields=["equipo"],
                condition=Q(rol_en_equipo="LIDER"),
                name="unico_lider_por_equipo",
            ),
            CheckConstraint(
                check=Q(fecha_inicio_indisponibilidad__lte=models.F("fecha_fin_indisponibilidad")) | Q(fecha_inicio_indisponibilidad__isnull=True) | Q(fecha_fin_indisponibilidad__isnull=True),
                name="chk_fechas_indisponibilidad",
            ),
        ]
        indexes = [
            models.Index(fields=["equipo", "estado"]),
            models.Index(fields=["usuario", "estado"]),
            models.Index(fields=["rol_en_equipo"]),
        ]

    def __str__(self):
        return f"{self.usuario} - {self.equipo} ({self.rol_en_equipo}/{self.estado})"