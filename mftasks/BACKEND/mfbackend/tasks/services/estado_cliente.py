from django.utils import timezone

from ..models import Tarea


def _fmt_fecha(valor):
    if not valor:
        return ""
    try:
        return timezone.localtime(valor).strftime("%d/%m/%Y %H:%M")
    except Exception:
        return str(valor)


def _fuera_de_tiempo(tarea):
    if tarea.estado not in (
        Tarea.Estado.APROBADO,
        Tarea.Estado.EN_DESARROLLO,
        Tarea.Estado.STAND_BY,
    ):
        return False
    try:
        from .tiempo_laboral import esta_fuera_de_tiempo_tarea

        return bool(esta_fuera_de_tiempo_tarea(tarea))
    except Exception:
        return False


def _subtareas_bloqueadas(tarea):
    from ..models import DependenciaSubtarea, Subtarea

    return DependenciaSubtarea.objects.filter(
        bloqueada__tarea=tarea,
        bloqueada__activo=True,
        bloqueadora__activo=True,
    ).exclude(
        bloqueadora__estado=Subtarea.Estado.SOLUCIONADO,
    ).exists()


def explicar_estado_cliente(tarea: Tarea) -> dict:
    """Devuelve textos claros para el cliente sin inventar información."""
    estado = tarea.estado
    explicacion = ""
    siguiente = ""
    motivo = None

    if estado == Tarea.Estado.EN_ESPERA:
        if tarea.paso_aprobacion == Tarea.PasoAprobacion.LIDER:
            explicacion = "Tu solicitud está en revisión del líder del equipo."
            siguiente = "El líder debe aprobarla o rechazarla para continuar."
            motivo = "Pendiente de revisión del líder."
        else:
            explicacion = "Tu solicitud está en revisión por la cadena de aprobación."
            siguiente = "Un aprobador debe revisar y aprobar la solicitud."
            motivo = "Pendiente de aprobación jerárquica."

    elif estado == Tarea.Estado.APROBADO:
        explicacion = "Tu solicitud fue aprobada y está pendiente de planificación."
        if tarea.fecha_inicio:
            siguiente = f"El inicio está programado para {_fmt_fecha(tarea.fecha_inicio)}."
        else:
            siguiente = "El equipo debe planificar e iniciar el trabajo."
        if _fuera_de_tiempo(tarea):
            motivo = "La fecha de entrega estimada ya pasó."

    elif estado == Tarea.Estado.EN_DESARROLLO:
        explicacion = (
            "El equipo está trabajando en tu solicitud "
            f"({float(tarea.progreso or 0):.1f}% completado)."
        )
        siguiente = (
            "El equipo completará las subtareas y marcará la solicitud como "
            "solucionada."
        )
        if _fuera_de_tiempo(tarea):
            motivo = "La fecha de entrega estimada ya pasó."
        elif _subtareas_bloqueadas(tarea):
            motivo = "Hay subtareas bloqueadas por dependencias pendientes."

    elif estado == Tarea.Estado.STAND_BY:
        explicacion = "Tu solicitud está temporalmente en pausa."
        siguiente = "El equipo debe reanudar el trabajo para continuar."
        motivo = (tarea.motivo_standby or "").strip() or "Pausa sin motivo registrado."

    elif estado == Tarea.Estado.SOLUCIONADO:
        if tarea.confirmacion_cliente == Tarea.ConfirmacionCliente.PENDIENTE:
            explicacion = "La solicitud fue solucionada y está pendiente de tu confirmación."
            if tarea.fecha_limite_confirmacion:
                siguiente = (
                    "Confirma la solución o reabre la solicitud antes del "
                    f"{_fmt_fecha(tarea.fecha_limite_confirmacion)}."
                )
            else:
                siguiente = "Confirma la solución o reabre la solicitud si no quedó resuelta."
            motivo = "Pendiente de confirmación del cliente."
        else:
            explicacion = "La solicitud fue solucionada y confirmada."
            siguiente = "No se requiere ninguna acción adicional."

    elif estado == Tarea.Estado.RECHAZADO:
        explicacion = "La solicitud fue rechazada."
        siguiente = "Puedes crear una nueva solicitud si lo necesitas."
        if tarea.motivo_rechazo:
            motivo = tarea.motivo_rechazo

    elif estado == Tarea.Estado.CANCELADO:
        explicacion = "La solicitud fue cancelada."
        siguiente = "Si necesitas retomar el trabajo, crea una nueva solicitud."
        if tarea.motivo_cancelacion:
            motivo = tarea.motivo_cancelacion

    return {
        "estado_explicado": explicacion,
        "siguiente_paso": siguiente,
        "motivo_demora": motivo,
    }
