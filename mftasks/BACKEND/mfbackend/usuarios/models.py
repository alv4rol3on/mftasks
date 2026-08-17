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


class EquipoMiembro(models.Model):

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

    fecha_ingreso = models.DateTimeField(
        auto_now_add=True
    )

    class Meta:
        unique_together = ("equipo", "usuario")

    def __str__(self):
        return f"{self.usuario} - {self.equipo}"