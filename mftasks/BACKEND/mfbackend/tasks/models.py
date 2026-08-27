from django.db import models
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
        default=0
    )

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
        on_delete=models.PROTECT
    )

class Subtarea(models.Model):

    class Estado(models.TextChoices):
        EN_ESPERA = "EN_ESPERA", "En espera"
        EN_DESARROLLO = "EN_DESARROLLO", "En desarrollo"
        SOLUCIONADO = "SOLUCIONADO", "Solucionado"

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
        default=Estado.EN_ESPERA
    )

    peso = models.PositiveIntegerField()

    fecha_creacion = models.DateTimeField(auto_now_add=True)
    fecha_inicio = models.DateTimeField(null=True, blank=True)
    fecha_fin = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"#{self.tarea} - {self.descripcion}"