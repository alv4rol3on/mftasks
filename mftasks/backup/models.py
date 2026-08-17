from django.db import models

class Task(models.Model):
    asunto = models.CharField(max_length=200)
    descripcion = models.TextField(blank=True)
    cliente = models.CharField(max_length=100)
    estado = models.CharField(max_length=50, default="PENDIENTE")
    fecha_solicitud = models.DateTimeField()
    fecha_inicio = models.DateTimeField(null=True, blank=True)
    fecha_fin_aproximada = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return self.asunto