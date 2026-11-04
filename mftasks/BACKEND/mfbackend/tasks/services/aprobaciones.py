from datetime import timedelta

from django.db import transaction
from django.utils import timezone


def obtener_fecha_limite_aprobacion(tarea):
    if tarea.fecha_limite_aprobacion:
        return tarea.fecha_limite_aprobacion

    # Compatibilidad con solicitudes antiguas.
    return tarea.fecha_creacion + timedelta(hours=72)


def aprobacion_vencida(tarea):
    return obtener_fecha_limite_aprobacion(tarea) <= timezone.now()


def rechazar_solicitud_vencida(tarea_id):
    from tasks.models import Tarea, AprobacionTarea, TareaLog
    from tasks.services.logs import registrar_log
    from tasks.services.notificaciones import notificar_tarea
    from tasks.services.notificaciones_email import programar_correo_tarea

    motivo = (
        "La solicitud fue rechazada automáticamente debido a que "
        "se ha cumplido el plazo máximo para una respuesta."
    )

    with transaction.atomic():
        try:
            tarea = (
                Tarea.objects
                .select_for_update()
                .select_related("solicitante")
                .get(pk=tarea_id)
            )
        except Tarea.DoesNotExist:
            return False

        if tarea.estado != Tarea.Estado.EN_ESPERA:
            return False

        if not aprobacion_vencida(tarea):
            return False

        estado_anterior = tarea.estado

        AprobacionTarea.objects.create(
            tarea=tarea,
            nivel=tarea.paso_aprobacion,
            usuario=None,
            accion=AprobacionTarea.Accion.RECHAZADO,
            motivo=motivo,
        )

        tarea.estado = Tarea.Estado.RECHAZADO
        tarea.paso_aprobacion = Tarea.PasoAprobacion.COMPLETADO
        tarea.motivo_rechazo = motivo
        tarea.fecha_respuesta = timezone.localtime(timezone.now())

        tarea.save(update_fields=[
            "estado",
            "paso_aprobacion",
            "motivo_rechazo",
            "fecha_respuesta",
        ])

    registrar_log(
        tarea=tarea,
        usuario=None,
        tipo_evento=TareaLog.TipoEvento.CAMBIO_ESTADO,
        estado_anterior=estado_anterior,
        estado_nuevo=tarea.estado,
        detalle=motivo,
    )

    notificar_tarea(tarea)

    programar_correo_tarea(
        evento="SOLICITUD_RECHAZADA",
        tarea=tarea,
        usuario_destinatario=tarea.solicitante,
        mensaje=motivo,
    )

    return True