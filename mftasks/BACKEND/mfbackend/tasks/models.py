from django.core.validators import MinValueValidator, MaxValueValidator
from django.db import models
from django.db.models import Q, CheckConstraint, UniqueConstraint

from usuarios.models import User, Equipo
from clientes.models import Cliente

class Tarea(models.Model):

    class Estado(models.TextChoices):
        EN_ESPERA = "EN_ESPERA", "En espera"
        APROBADO = "APROBADO", "Aprobado"
        EN_DESARROLLO = "EN_DESARROLLO", "En desarrollo"
        RECHAZADO = "RECHAZADO", "Rechazado"
        SOLUCIONADO = "SOLUCIONADO", "Solucionado"

    asunto = models.CharField(max_length=200)
    descripcion = models.TextField()

    cliente = models.ForeignKey(
        Cliente,
        on_delete=models.PROTECT,
        related_name="tareas"
    )

    estado = models.CharField(
        max_length=20,
        choices=Estado.choices,
        default=Estado.EN_ESPERA
    )

    fecha_creacion = models.DateTimeField(auto_now_add=True)
    fecha_respuesta = models.DateTimeField(null=True, blank=True)
    fecha_inicio = models.DateTimeField(null=True, blank=True)
    fecha_entrega_aproximada = models.DateTimeField(null=True, blank=True)

    aprobador = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name="tareas_aprobadas",
        null=True,
        blank=True,
    )

    solicitante = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="tareas_solicitadas"
    )

    equipo = models.ForeignKey(
        Equipo,
        on_delete=models.PROTECT,
        related_name="tareas"
    )

    motivo_rechazo = models.TextField(blank=True)

    progreso = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        db_index=True,
    )

    # Fase 2: subcampana se añade luego, campo nullable para migración incremental
    subcampana = models.ForeignKey(
        "campanas.SubCampana",
        on_delete=models.PROTECT,
        related_name="tareas",
        null=True,
        blank=True,
    )

    dependencias = models.ManyToManyField(
        "self",
        symmetrical=False,
        through="DependenciaTarea",
        related_name="tareas_bloqueadas",
        blank=True,
    )

    class Meta:
        indexes = [
            models.Index(fields=["estado", "equipo"]),
            models.Index(fields=["solicitante", "estado"]),
            models.Index(fields=["cliente", "estado"]),
            models.Index(fields=["fecha_creacion"]),
        ]
        constraints = [
            CheckConstraint(check=Q(progreso__gte=0, progreso__lte=100), name="chk_tarea_progreso_0_100"),
        ]

    def __str__(self):
        return self.asunto

class ArchivoTarea(models.Model):

    tarea = models.ForeignKey(
        Tarea,
        on_delete=models.CASCADE,
        related_name="archivos"
    )

    archivo = models.FileField(upload_to="tareas/")
    nombre = models.CharField(max_length=255)
    fecha_subida = models.DateTimeField(auto_now_add=True)

    subido_por = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name="archivos_subidos",
    )

    class Meta:
        indexes = [
            models.Index(fields=["tarea"]),
        ]

class Subtarea(models.Model):

    class Estado(models.TextChoices):
        EN_ESPERA = "EN_ESPERA", "En espera"
        EN_DESARROLLO = "EN_DESARROLLO", "En desarrollo"
        SOLUCIONADO = "SOLUCIONADO", "Solucionado"
        STAND_BY = "STAND_BY", "En pausa"

    tarea = models.ForeignKey(
        Tarea,
        on_delete=models.CASCADE,
        related_name="subtareas"
    )

    descripcion = models.TextField()

    asignado = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name="subtareas"
    )

    estado = models.CharField(
        max_length=20,
        choices=Estado.choices,
        default=Estado.EN_ESPERA,
        db_index=True,
    )

    peso = models.PositiveIntegerField(validators=[MinValueValidator(1)])

    fecha_creacion = models.DateTimeField(auto_now_add=True)
    fecha_inicio = models.DateTimeField(null=True, blank=True)
    fecha_fin = models.DateTimeField(null=True, blank=True)

    # Fase 3: STAND_BY justificación
    motivo_standby = models.TextField(blank=True)
    fecha_standby = models.DateTimeField(null=True, blank=True)
    standby_por = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="standbys_realizados",
    )

    # Fase 4: dependencias
    dependencias = models.ManyToManyField(
        "self",
        symmetrical=False,
        through="DependenciaSubtarea",
        related_name="bloqueadas",
        blank=True,
    )

    class Meta:
        indexes = [
            models.Index(fields=["tarea", "estado"]),
            models.Index(fields=["asignado", "estado"]),
        ]
        constraints = [
            CheckConstraint(check=Q(peso__gte=1), name="chk_subtarea_peso_gte1"),
            CheckConstraint(
                check=Q(estado="STAND_BY", motivo_standby__isnull=False) | ~Q(estado="STAND_BY") | Q(motivo_standby=""),
                name="chk_standby_motivo_lenient",
            ),
        ]

    def __str__(self):
        return f"#{self.tarea} - {self.descripcion}"


class DependenciaSubtarea(models.Model):
    bloqueada = models.ForeignKey(Subtarea, on_delete=models.CASCADE, related_name="dependencias_origen")
    bloqueadora = models.ForeignKey(Subtarea, on_delete=models.CASCADE, related_name="dependencias_destino")

    class Meta:
        unique_together = ("bloqueada", "bloqueadora")
        constraints = [
            CheckConstraint(check=~Q(bloqueada=models.F("bloqueadora")), name="chk_dep_no_self"),
        ]

    def __str__(self):
        return f"{self.bloqueada_id} depende de {self.bloqueadora_id}"


class DependenciaTarea(models.Model):
    bloqueada = models.ForeignKey(Tarea, on_delete=models.CASCADE, related_name="dependencias_origen")
    bloqueadora = models.ForeignKey(Tarea, on_delete=models.CASCADE, related_name="dependencias_destino")

    class Meta:
        unique_together = ("bloqueada", "bloqueadora")
        constraints = [
            CheckConstraint(check=~Q(bloqueada=models.F("bloqueadora")), name="chk_dep_tarea_no_self"),
        ]

    def __str__(self):
        return f"Tarea {self.bloqueada_id} depende de {self.bloqueadora_id}"