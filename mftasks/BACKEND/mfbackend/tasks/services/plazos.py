from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from ..models import ConfiguracionAprobacion, Tarea
from .tiempo_laboral import sumar_tiempo_laboral


def recalcular_plazos_pendientes() -> None:
    """Recalcula los vencimientos abiertos con la configuración actual.

    - Aprobaciones: solicitudes aún en EN_ESPERA.
    - Confirmaciones: soluciones pendientes de confirmación del cliente.
    """
    config = ConfiguracionAprobacion.obtener()
    ahora = timezone.now()

    with transaction.atomic():
        aprobaciones = []
        for tarea in (
            Tarea.objects
            .filter(estado=Tarea.Estado.EN_ESPERA, activo=True)
            .only("id", "fecha_creacion", "fecha_limite_aprobacion")
            .iterator()
        ):
            tarea.fecha_limite_aprobacion = sumar_tiempo_laboral(
                tarea.fecha_creacion,
                timedelta(hours=config.horas_limite),
            )
            aprobaciones.append(tarea)

        if aprobaciones:
            Tarea.objects.bulk_update(
                aprobaciones,
                ["fecha_limite_aprobacion"],
                batch_size=200,
            )

        confirmaciones = []
        for tarea in (
            Tarea.objects
            .filter(
                estado=Tarea.Estado.SOLUCIONADO,
                confirmacion_cliente=Tarea.ConfirmacionCliente.PENDIENTE,
                activo=True,
            )
            .only(
                "id",
                "fecha_solucion",
                "fecha_limite_confirmacion",
                "confirmacion_cliente",
                "fecha_confirmacion_cliente",
            )
            .iterator()
        ):
            if config.horas_confirmacion == 0:
                tarea.confirmacion_cliente = Tarea.ConfirmacionCliente.CONFIRMADA
                tarea.fecha_confirmacion_cliente = ahora
                tarea.fecha_limite_confirmacion = None
                confirmaciones.append(tarea)
                continue

            tarea.fecha_confirmacion_cliente = None
            tarea.fecha_limite_confirmacion = sumar_tiempo_laboral(
                tarea.fecha_solucion or ahora,
                timedelta(hours=config.horas_confirmacion),
            )
            confirmaciones.append(tarea)

        if confirmaciones:
            Tarea.objects.bulk_update(
                confirmaciones,
                [
                    "fecha_limite_confirmacion",
                    "confirmacion_cliente",
                    "fecha_confirmacion_cliente",
                ],
                batch_size=200,
            )
