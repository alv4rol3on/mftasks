from django.core.validators import MinValueValidator, MaxValueValidator
from django.db import models
from django.db.models import Q, CheckConstraint, UniqueConstraint

from usuarios.models import User, Equipo

class Tarea(models.Model):

    class Estado(models.TextChoices):
        EN_ESPERA = "EN_ESPERA", "En espera"
        APROBADO = "APROBADO", "Aprobado"
        EN_DESARROLLO = "EN_DESARROLLO", "En desarrollo"
        RECHAZADO = "RECHAZADO", "Rechazado"
        SOLUCIONADO = "SOLUCIONADO", "Solucionado"
        STAND_BY = "STAND_BY", "En pausa"

    ticket = models.CharField(max_length=20, unique=True, blank=True, null=True, db_index=True)

    asunto = models.CharField(max_length=200)
    descripcion = models.TextField()

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
            models.Index(fields=["ticket"]),
            models.Index(fields=["activo"]),
        ]
        constraints = [
            CheckConstraint(check=Q(progreso__gte=0, progreso__lte=100), name="chk_tarea_progreso_0_100"),
        ]

    def save(self, *args, **kwargs):
        if not self.ticket:
            from django.utils import timezone
            from django.db import transaction
            # YYYYMMDD00001 basado en fecha_creacion (America/Lima)
            if not self.fecha_creacion:
                base_date = timezone.localtime(timezone.now())
            else:
                try:
                    base_date = timezone.localtime(self.fecha_creacion) if timezone.is_naive(self.fecha_creacion) or self.fecha_creacion.tzinfo else self.fecha_creacion
                except Exception:
                    base_date = timezone.localtime(timezone.now())
            prefix = base_date.strftime('%Y%m%d')
            # Usar transacción atómica + MAX para correlativo diario y retry por unique
            for _ in range(5):
                # Buscar último ticket del día
                try:
                    with transaction.atomic():
                        # Lock: select max dentro de transacción para evitar carrera en SQLite
                        max_ticket = Tarea.objects.filter(ticket__startswith=prefix).order_by('-ticket').values_list('ticket', flat=True).first()
                        if max_ticket and len(max_ticket) >= 13 and max_ticket[:8] == prefix:
                            try:
                                seq = int(max_ticket[8:13]) + 1
                            except ValueError:
                                seq = 1
                        else:
                            # fallback: contar
                            seq = Tarea.objects.filter(ticket__startswith=prefix).count() + 1
                        candidate = f"{prefix}{seq:05d}"
                        if not Tarea.objects.filter(ticket=candidate).exists():
                            self.ticket = candidate
                            break
                except Exception:
                    continue
            if not self.ticket:
                import uuid
                self.ticket = f"{prefix}{uuid.uuid4().int % 90000 + 10000:05d}"
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
            models.Index(fields=["activo"]),
            models.Index(fields=["codigo"]),
        ]
        constraints = [
            CheckConstraint(check=Q(peso__gte=1), name="chk_subtarea_peso_gte1"),
            CheckConstraint(
                check=Q(estado="STAND_BY", motivo_standby__isnull=False) | ~Q(estado="STAND_BY") | Q(motivo_standby=""),
                name="chk_standby_motivo_lenient",
            ),
        ]

    def save(self, *args, **kwargs):
        if not self.codigo and self.tarea_id:
            # Generar codigo YYYYMMDD00001-001 basado en ticket de la tarea
            from django.db import transaction
            for _ in range(5):
                try:
                    with transaction.atomic():
                        tarea_ticket = None
                        if hasattr(self, 'tarea') and self.tarea_id:
                            try:
                                tarea_ticket = self.tarea.ticket if hasattr(self.tarea, 'ticket') and self.tarea.ticket else None
                            except Exception:
                                tarea_ticket = None
                        if not tarea_ticket:
                            tarea_ticket = Tarea.objects.filter(id=self.tarea_id).values_list('ticket', flat=True).first()
                        if not tarea_ticket:
                            break
                        # correlativo por tarea
                        existing = Subtarea.objects.filter(tarea_id=self.tarea_id).exclude(pk=self.pk)
                        # buscar max seq
                        max_codigo = existing.filter(codigo__startswith=f"{tarea_ticket}-").order_by('-codigo').values_list('codigo', flat=True).first()
                        if max_codigo and '-' in max_codigo:
                            try:
                                seq = int(max_codigo.split('-')[-1]) + 1
                            except ValueError:
                                seq = existing.count() + 1
                        else:
                            seq = existing.count() + 1
                        candidate = f"{tarea_ticket}-{seq:03d}"
                        if not Subtarea.objects.filter(codigo=candidate).exists():
                            self.codigo = candidate
                            break
                except Exception:
                    continue
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