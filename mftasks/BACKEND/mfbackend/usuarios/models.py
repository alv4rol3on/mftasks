from django.contrib.auth.models import AbstractUser
from django.db import models
from django.db.models import Q, UniqueConstraint, CheckConstraint
from django.db.models.functions import Lower
from django.conf import settings
from datetime import time
from django.core.validators import RegexValidator


from .managers import UserManager


class TipoUsuario(models.TextChoices):
    """Comportamiento general y navegación del usuario.

    Independiente del rol jerárquico: solo COLABORADOR requiere un Rol.
    """

    COLABORADOR = "COLABORADOR", "Colaborador"
    CLIENTE = "CLIENTE", "Cliente"
    ADMINISTRADOR = "ADMINISTRADOR", "Administrador"


class User(AbstractUser):
    username = None

    dni = models.CharField(
        max_length=8,
        unique=True,
        blank=False,
        null=True,
        validators=[
            RegexValidator(
                regex=r"^\d{8}$",
                message="El DNI debe contener exactamente 8 números.",
            )
        ],
    )

    email = models.EmailField(unique=True)

    

    tipo_usuario = models.CharField(
        max_length=20,
        choices=TipoUsuario.choices,
        default=TipoUsuario.COLABORADOR,
        db_index=True,
    )

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

    descripcion_cargo = models.TextField(blank=True)

    telefono = models.CharField(max_length=20, blank=True)

    codigo = models.CharField(max_length=20, unique=True, blank=True, null=True, db_index=True)

    fecha_creacion = models.DateTimeField(auto_now_add=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    objects = UserManager()

    def save(self, *args, **kwargs):
        if not self.codigo:
            import random
            from django.utils import timezone
            base_date = self.fecha_creacion if self.fecha_creacion and hasattr(self.fecha_creacion, "strftime") else timezone.now()
            try:
                prefix = f"MFS-{base_date.strftime('%Y%m%d')}"
            except Exception:
                prefix = f"MFS-{timezone.now().strftime('%Y%m%d')}"
            for _ in range(5):
                candidate = f"{prefix}-{random.randint(10000, 99999)}"
                if not User.objects.filter(codigo=candidate).exists():
                    self.codigo = candidate
                    break
            if not self.codigo:
                import uuid
                self.codigo = f"MFS-{uuid.uuid4().hex[:5].upper()}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.nombres} {self.apellidos} [{self.codigo}]" if self.codigo else f"{self.nombres} {self.apellidos}"


class Rol(models.Model):

    nombre = models.CharField(
        max_length=50,
        unique=True
    )

    descripcion = models.TextField(blank=True)

    activo = models.BooleanField(default=True)

    superior = models.ForeignKey(
        "self",
        on_delete=models.PROTECT,
        related_name="subordinados",
        null=True,
        blank=True,
        help_text=(
            "Rol superior directo que aprueba las solicitudes de este rol. "
            "Vacío en el rol raíz de la organización."
        ),
    )

    puede_liderar = models.BooleanField(
        default=False,
        help_text="Si está activo, los usuarios con este rol pueden ser líderes de un equipo.",
    )

    auto_aprobar = models.BooleanField(
        default=False,
        help_text=(
            "Si está activo, las solicitudes de equipos de este rol saltan la "
            "fase de aprobadores y pasan directo a revisión del líder."
        ),
    )

    color = models.CharField(
        max_length=7,
        blank=True,
        default="",
        validators=[
            RegexValidator(
                r"^#(?:[0-9a-fA-F]{6})$",
                "Use un color hexadecimal en formato #RRGGBB.",
            )
        ],
        help_text=(
            "Color hexadecimal (#RRGGBB) que heredan los equipos de este rol "
            "para la barra de su tarjeta. Vacío = neutro."
        ),
    )

    class Meta:
        constraints = [
            UniqueConstraint(Lower("nombre"), name="rol_nombre_unique_lower"),
        ]

    def __str__(self):
        return self.nombre

    def clean(self):
        from django.core.exceptions import ValidationError

        super().clean()
        if self.pk and self.superior_id == self.pk:
            raise ValidationError(
                {"superior": "Un rol no puede ser su propio superior."}
            )
        # Detectar ciclos recorriendo la cadena de superiores.
        visitados = set()
        actual = self.superior
        while actual is not None:
            if actual.pk == self.pk:
                raise ValidationError(
                    {
                        "superior": (
                            "La relación de aprobación no puede contener ciclos."
                        )
                    }
                )
            if actual.pk in visitados:
                break
            visitados.add(actual.pk)
            actual = actual.superior


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

    class TipoEquipo(models.TextChoices):
        GERENTE = "GERENTE", "Equipo de Gerente"
        SUBGERENTE = "SUBGERENTE", "Equipo de Subgerente"
        JEFE = "JEFE", "Equipo de Jefe"
        GTR = "GTR", "Equipo GTR"

    tipo_equipo = models.CharField(
        max_length=20,
        choices=TipoEquipo.choices,
        default=TipoEquipo.GTR,
        db_index=True,
        help_text=(
            "[DEPRECADO] Espejo del nombre del rol del líder. "
            "La fuente de verdad es rol_equipo."
        ),
    )

    rol_equipo = models.ForeignKey(
        Rol,
        on_delete=models.PROTECT,
        related_name="equipos",
        null=True,
        blank=True,
        help_text="Rol del líder que determina la cadena de aprobación del equipo.",
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
        from .jerarquia import rol_efectivo

        is_new = self._state.adding
        old_lider_id = None
        if not is_new:
            try:
                old = Equipo.objects.only("lider_id").get(pk=self.pk)
                old_lider_id = old.lider_id
            except Equipo.DoesNotExist:
                old_lider_id = None

        # rol_equipo (fuente de verdad) y tipo_equipo (espejo) derivados del líder
        if self.lider_id:
            try:
                rol = rol_efectivo(self.lider)
            except Exception:
                rol = None
            if rol is not None:
                self.rol_equipo = rol
                self.tipo_equipo = rol.nombre

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
        # Deprecado: se conserva por compatibilidad de datos, no se ofrece en UI.
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


class PreferenciaNotificacion(models.Model):
    """Preferencias de correo por usuario."""

    usuario = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="preferencias_notificacion",
    )

    recibir_correos = models.BooleanField(default=True)

    # Cliente
    cliente_solicitud_creada = models.BooleanField(default=True)
    cliente_solicitud_resuelta = models.BooleanField(default=True)
    cliente_solicitud_standby = models.BooleanField(default=True)
    cliente_solicitud_reanudada = models.BooleanField(default=True)
    cliente_solicitud_solucionada = models.BooleanField(default=True)
    cliente_resumen_diario = models.BooleanField(default=True)

    # Líder / Miembro del equipo
    equipo_nueva_solicitud = models.BooleanField(default=True)
    equipo_pendiente_revision = models.BooleanField(default=True)
    equipo_alerta_diaria = models.BooleanField(default=True)
    equipo_hora_alerta_diaria = models.TimeField(
        default=time(8, 0),
    )

    fecha_actualizacion = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Preferencia de notificación"
        verbose_name_plural = "Preferencias de notificación"

    def __str__(self):
        return f"Preferencias de {self.usuario}"