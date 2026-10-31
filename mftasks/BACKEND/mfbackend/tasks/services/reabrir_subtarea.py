from django.db import transaction
from django.utils import timezone

from ..models import Subtarea, Tarea, TareaLog
from .logs import registrar_log
from .notificaciones import notificar_subtarea, notificar_tarea


class ReaperturaSubtareaInvalida(Exception):
    pass


def _recalcular_progreso(tarea):
    subtareas = Subtarea.objects.filter(tarea=tarea, activo=True)
    total_peso = sum(s.peso for s in subtareas)
    peso_solucionado = sum(
        s.peso for s in subtareas if s.estado == Subtarea.Estado.SOLUCIONADO
    )
    tarea.progreso = (
        round((peso_solucionado / total_peso) * 100, 2)
        if total_peso > 0
        else 0
    )


def reabrir_subtarea(tarea, subtarea, usuario, motivo):
    motivo = (motivo or "").strip()
    if not motivo:
        raise ReaperturaSubtareaInvalida("El motivo de reapertura es obligatorio.")

    with transaction.atomic():
        actual_tarea = Tarea.objects.select_for_update().get(pk=tarea.pk)
        actual = Subtarea.objects.select_for_update().get(pk=subtarea.pk)

        if actual.tarea_id != actual_tarea.id:
            raise ReaperturaSubtareaInvalida("La subtarea no pertenece a la solicitud.")
        if not actual.activo:
            raise ReaperturaSubtareaInvalida("No se puede reabrir una subtarea inactiva.")
        if actual.estado != Subtarea.Estado.SOLUCIONADO:
            raise ReaperturaSubtareaInvalida("Solo se puede reabrir una subtarea solucionada.")
        if actual_tarea.estado in (
            Tarea.Estado.RECHAZADO,
            Tarea.Estado.CANCELADO,
        ):
            raise ReaperturaSubtareaInvalida(
                "No se puede reabrir una subtarea de una solicitud cerrada."
            )

        ahora = timezone.localtime(timezone.now())
        estado_anterior = actual.estado

        actual.estado = Subtarea.Estado.EN_DESARROLLO
        actual.fecha_fin = None
        actual.fecha_inicio = ahora
        actual.motivo_standby = ""
        actual.fecha_standby = None
        actual.fecha_fin_standby = None
        actual.standby_por = None
        actual.save(
            update_fields=[
                "estado",
                "fecha_fin",
                "fecha_inicio",
                "motivo_standby",
                "fecha_standby",
                "fecha_fin_standby",
                "standby_por",
            ]
        )

        estado_tarea_anterior = actual_tarea.estado
        if actual_tarea.estado == Tarea.Estado.SOLUCIONADO:
            actual_tarea.estado = Tarea.Estado.EN_DESARROLLO
            actual_tarea.fecha_solucion = None
            actual_tarea.confirmacion_cliente = Tarea.ConfirmacionCliente.REABIERTA
            actual_tarea.fecha_limite_confirmacion = None
            actual_tarea.fecha_confirmacion_cliente = None
            actual_tarea.save(
                update_fields=[
                    "estado",
                    "fecha_solucion",
                    "confirmacion_cliente",
                    "fecha_limite_confirmacion",
                    "fecha_confirmacion_cliente",
                ]
            )

        _recalcular_progreso(actual_tarea)
        actual_tarea.save(update_fields=["progreso"])

        registrar_log(
            tarea=actual_tarea,
            subtarea=actual,
            usuario=usuario,
            tipo_evento=TareaLog.TipoEvento.REAPERTURA,
            estado_anterior=estado_anterior,
            estado_nuevo=actual.estado,
            detalle=(
                f"Subtarea reabierta por {usuario.nombres} {usuario.apellidos}. "
                f"Motivo: {motivo}"
            ),
        )

        if estado_tarea_anterior != actual_tarea.estado:
            registrar_log(
                tarea=actual_tarea,
                usuario=usuario,
                tipo_evento=TareaLog.TipoEvento.CAMBIO_ESTADO,
                estado_anterior=estado_tarea_anterior,
                estado_nuevo=actual_tarea.estado,
                detalle=(
                    "La solicitud volvió a En desarrollo por reapertura de "
                    f"la subtarea {actual.codigo or actual.id}."
                ),
            )

    transaction.on_commit(lambda: notificar_subtarea(actual_tarea, actual))
    transaction.on_commit(lambda: notificar_tarea(actual_tarea))
    return actual
