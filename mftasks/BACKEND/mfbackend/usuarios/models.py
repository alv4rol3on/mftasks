from django.contrib.auth.models import AbstractUser
from django.db import models
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

    activo = models.BooleanField(default=True)

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

    def save(self, *args, **kwargs):
        is_new = self._state.adding
        old_lider_id = None
        if not is_new:
            try:
                old = Equipo.objects.get(pk=self.pk)
                old_lider_id = old.lider_id
            except Equipo.DoesNotExist:
                old_lider_id = None
        super().save(*args, **kwargs)
        # Sincronizar EquipoMiembro LIDER
        try:
            if is_new:
                EquipoMiembro.objects.get_or_create(
                    equipo=self,
                    usuario_id=self.lider_id,
                    defaults={"rol_en_equipo": EquipoMiembro.RolEnEquipo.LIDER, "estado": EquipoMiembro.EstadoMiembro.ACTIVO},
                )
                # Asegurar rol LIDER si ya existia
                EquipoMiembro.objects.filter(equipo=self, usuario_id=self.lider_id).update(rol_en_equipo=EquipoMiembro.RolEnEquipo.LIDER)
            else:
                if old_lider_id and old_lider_id != self.lider_id:
                    # Degradar anterior lider a MIEMBRO si tenia rol LIDER
                    EquipoMiembro.objects.filter(equipo=self, usuario_id=old_lider_id, rol_en_equipo=EquipoMiembro.RolEnEquipo.LIDER).update(rol_en_equipo=EquipoMiembro.RolEnEquipo.MIEMBRO)
                    EquipoMiembro.objects.get_or_create(
                        equipo=self,
                        usuario_id=self.lider_id,
                        defaults={"rol_en_equipo": EquipoMiembro.RolEnEquipo.LIDER, "estado": EquipoMiembro.EstadoMiembro.ACTIVO},
                    )
                    EquipoMiembro.objects.filter(equipo=self, usuario_id=self.lider_id).update(rol_en_equipo=EquipoMiembro.RolEnEquipo.LIDER)
        except Exception:
            pass


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

    class Meta:
        unique_together = ("equipo", "usuario")

    def __str__(self):
        return f"{self.usuario} - {self.equipo} ({self.rol_en_equipo}/{self.estado})"