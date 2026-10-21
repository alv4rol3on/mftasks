from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator, MaxValueValidator
from django.db import models
from django.db.models import Q, CheckConstraint

from usuarios.models import User, Equipo


class SecuenciaTicket(models.Model):
    fecha = models.DateField(unique=True)
    ultimo = models.PositiveIntegerField(default=0)

    class Meta:
        verbose_name = "Secuencia de ticket"
        verbose_name_plural = "Secuencias de ticket"

    def __str__(self):
        return f"{self.fecha:%Y%m%d}: {self.ultimo}"


class Tarea(models.Model):

    class Estado(models.TextChoices):
        EN_ESPERA = "EN_ESPERA", "En espera"
        APROBADO = "APROBADO", "Aprobado"
        EN_DESARROLLO = "EN_DESARROLLO", "En desarrollo"
        RECHAZADO = "RECHAZADO", "Rechazado"
        SOLUCIONADO = "SOLUCIONADO", "Solucionado"
        STAND_BY = "STAND_BY", "En pausa"
        CANCELADO = "CANCELADO", "Cancelado"

    class PasoAprobacion(models.TextChoices):
        APROBADORES = "APROBADORES", "Aprobadores"
        LIDER = "LIDER", "Revisión del líder"
        COMPLETADO = "COMPLETADO", "Completado"

    class TipoSolicitud(models.TextChoices):
        NUEVA_FUNCIONALIDAD = "NUEVA_FUNCIONALIDAD", "Nueva funcionalidad"
        REPORTE = "REPORTE", "Creación de reporte"
        CORRECCION_ERROR = "CORRECCION_ERROR", "Corrección de error"
        CREACION_BI = "CREACION_BI", "Creación de BI"
        OTROS = "OTROS", "Otros"

    ticket = models.CharField(max_length=20, unique=True, blank=True, null=True, db_index=True)

    asunto = models.CharField(max_length=200)
    tipo_solicitud = models.CharField(
        max_length=30,
        choices=TipoSolicitud.choices,
        default=TipoSolicitud.OTROS,
        db_index=True,
        verbose_name="Tipo de solicitud",
    )
    detalle_tipo_solicitud = models.CharField(
        max_length=255,
        blank=True,
        default="",
        verbose_name="Detalle de otros",
        help_text="Especificar cuando el tipo de solicitud sea Otros.",
    )
    descripcion = models.TextField()

    estado = models.CharField(
        max_length=20,
        choices=Estado.choices,
        default=Estado.EN_ESPERA
    )

    paso_aprobacion = models.CharField(
        max_length=20,
        choices=PasoAprobacion.choices,
        default=PasoAprobacion.APROBADORES,
        db_index=True,
        help_text="Fase de aprobación que debe resolverse: aprobadores del equipo o su líder.",
    )

    aprobador = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name="tareas_aprobadas",
        null=True,
        blank=True,
    )

    fecha_creacion = models.DateTimeField(auto_now_add=True)
    fecha_respuesta = models.DateTimeField(null=True, blank=True)
    fecha_inicio = models.DateTimeField(null=True, blank=True)
    fecha_entrega_aproximada = models.DateTimeField(null=True, blank=True)

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
    motivo_cancelacion = models.TextField(blank=True)

    motivo_standby = models.TextField(blank=True)
    fecha_standby = models.DateTimeField(null=True, blank=True)
    fecha_fin_standby = models.DateTimeField(null=True, blank=True)
    standby_por = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="tareas_standby",
    )
    fecha_solucion = models.DateTimeField(null=True, blank=True)

    incluye_sabado = models.BooleanField(default=False, help_text="Si está activo, el contador incluye sábados de 9am a 1pm; si no, solo L-V 9-18.")

    activo = models.BooleanField(default=True, db_index=True)
    fecha_inactivacion = models.DateTimeField(null=True, blank=True)
    inactivada_por = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="tareas_inactivadas",
    )

    progreso = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        db_index=True,
    )

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
            models.Index(fields=["subcampana", "estado"]),
            models.Index(fields=["fecha_creacion"]),
        ]
        constraints = [
            CheckConstraint(check=Q(progreso__gte=0, progreso__lte=100), name="chk_tarea_progreso_0_100"),
        ]

    def save(self, *args, **kwargs):
        # La solicitud nace directamente en revisión del líder cuando:
        #   - el rol del equipo es la raíz (no tiene superiores), o
        #   - el rol del equipo tiene autoaprobación, o
        #   - ningún superior de la cadena tiene permiso a la subcampaña.
        if self._state.adding and self.equipo_id and self.estado == self.Estado.EN_ESPERA:
            from usuarios.jerarquia import roles_aprobador_de_equipo
            from tasks.permissions import hay_aprobadores_con_permiso

            rol_equipo = getattr(self.equipo, "rol_equipo", None)
            auto_aprobar = bool(
                rol_equipo is not None
                and getattr(rol_equipo, "auto_aprobar", False)
            )

            if (
                not roles_aprobador_de_equipo(self.equipo)
                or auto_aprobar
                or not hay_aprobadores_con_permiso(self)
            ):
                self.paso_aprobacion = self.PasoAprobacion.LIDER
        if not self.ticket:
            from .services.tickets import asignar_ticket_tarea

            asignar_ticket_tarea(self)

        super().save(*args, **kwargs)

    def __str__(self):
        return f"[{self.ticket}] {self.asunto}" if self.ticket else self.asunto

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
    fecha_fin_standby = models.DateTimeField(null=True, blank=True)
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

    codigo = models.CharField(max_length=30, unique=True, blank=True, null=True, db_index=True, help_text="Formato YYYYMMDD00001-001 basado en ticket de la tarea")

    # Inactivación soft para pestaña Asignaciones
    activo = models.BooleanField(default=True, db_index=True)
    fecha_inactivacion = models.DateTimeField(null=True, blank=True)
    inactivada_por = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="subtareas_inactivadas",
    )

    class Meta:
        indexes = [
            models.Index(fields=["tarea", "estado"]),
            models.Index(fields=["asignado", "estado"]),
            models.Index(fields=["tarea", "activo"]),
        ]
        constraints = [
            CheckConstraint(check=Q(peso__gte=1), name="chk_subtarea_peso_gte1"),
            CheckConstraint(
                check=~Q(estado="STAND_BY") | ~Q(motivo_standby=""),
                name="chk_standby_motivo",
            ),
        ]

    def clean(self):
        super().clean()
        if (
            self.estado == self.Estado.STAND_BY
            and not (self.motivo_standby or "").strip()
        ):
            raise ValidationError({
                "motivo_standby": "El motivo es obligatorio en STAND_BY."
            })

    def save(self, *args, **kwargs):
        if not self.codigo and self.tarea_id:
            from .services.tickets import asignar_codigo_subtarea

            asignar_codigo_subtarea(self)

        super().save(*args, **kwargs)

    def __str__(self):
        return f"[{self.codigo}] {self.descripcion}" if self.codigo else f"#{self.tarea_id} - {self.descripcion}"
    

#LOGS
class TareaLog(models.Model):

    class TipoEvento(models.TextChoices):
        CREACION = "CREACION", "Creación"
        INICIO = "INICIO", "Inicio"
        CAMBIO_ESTADO = "CAMBIO_ESTADO", "Cambio de estado"
        STANDBY_INICIO = "STANDBY_INICIO", "Inicio de standby"
        STANDBY_FIN = "STANDBY_FIN", "Fin de standby"
        FIN = "FIN", "Fin"
        CAMBIO_ASIGNADO = "CAMBIO_ASIGNADO", "Cambio de asignado"
        CAMBIO_PROGRESO = "CAMBIO_PROGRESO", "Cambio de progreso"
        CANCELACION = "CANCELACION", "Cancelación"

    tarea = models.ForeignKey(
        Tarea,
        on_delete=models.CASCADE,
        related_name="logs",
    )

    subtarea = models.ForeignKey(
        Subtarea,
        on_delete=models.CASCADE,
        related_name="logs",
        null=True,
        blank=True,
    )

    usuario = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="tarea_logs",
    )

    tipo_evento = models.CharField(
        max_length=30,
        choices=TipoEvento.choices,
    )

    estado_anterior = models.CharField(
        max_length=20,
        null=True,
        blank=True,
    )

    estado_nuevo = models.CharField(
        max_length=20,
        null=True,
        blank=True,
    )

    fecha = models.DateTimeField(
        auto_now_add=True,
        db_index=True,
    )

    detalle = models.TextField(
        blank=True,
    )

    standby_excluido = models.BooleanField(
        default=True,
        help_text=(
            "Si es True, el tiempo de este período de standby se excluye del "
            "contador. Al elegir cómo reanudar se guarda False y el efecto pasa "
            "a la fecha de entrega."
        ),
    )

    class Meta:
        ordering = ["fecha"]

        indexes = [
            models.Index(fields=["tarea", "fecha"]),
            models.Index(fields=["subtarea", "fecha"]),
            models.Index(fields=["tipo_evento", "fecha"]),
        ]

    def __str__(self):
        objeto = (
            f"Subtarea #{self.subtarea_id}"
            if self.subtarea_id
            else f"Tarea #{self.tarea_id}"
        )

        return f"{objeto} - {self.tipo_evento} - {self.fecha}"



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


class AprobacionTarea(models.Model):
    """Historial de acciones de la cadena de aprobación de una solicitud."""

    class Accion(models.TextChoices):
        APROBADO = "APROBADO", "Aprobado"
        RECHAZADO = "RECHAZADO", "Rechazado"

    tarea = models.ForeignKey(
        Tarea,
        on_delete=models.CASCADE,
        related_name="aprobaciones",
    )

    nivel = models.CharField(
        max_length=20,
        choices=Tarea.PasoAprobacion.choices,
    )

    usuario = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="aprobaciones_realizadas",
    )

    accion = models.CharField(
        max_length=20,
        choices=Accion.choices,
    )

    motivo = models.TextField(blank=True)

    fecha = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["fecha", "id"]
        indexes = [
            models.Index(fields=["tarea", "fecha"]),
            models.Index(fields=["nivel"]),
        ]

    def __str__(self):
        return f"[{self.tarea_id}] {self.nivel} - {self.accion}"