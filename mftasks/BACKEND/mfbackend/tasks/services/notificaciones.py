import logging

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

logger = logging.getLogger(__name__)


def _enviar_grupo(group_name, payload):
    channel_layer = get_channel_layer()

    if channel_layer is None:
        return

    try:
        async_to_sync(channel_layer.group_send)(group_name, payload)
    except Exception:
        logger.exception("No se pudo enviar el evento websocket %s", group_name)


def _progreso(tarea):
    return float(tarea.progreso or 0)


def notificar_tarea(tarea):
    """Emite el estado actual de la tarea al grupo tarea_<id>."""
    _enviar_grupo(
        f"tarea_{tarea.id}",
        {
            "type": "task_status_changed",
            "task_id": tarea.id,
            "estado_nuevo": tarea.estado,
            "progreso": _progreso(tarea),
            "activo": bool(tarea.activo),
        },
    )


def notificar_subtarea(tarea, subtarea):
    """Emite el estado de una subtarea (y el progreso de su tarea)."""
    _enviar_grupo(
        f"tarea_{tarea.id}",
        {
            "type": "subtask_status_changed",
            "task_id": tarea.id,
            "subtarea_id": subtarea.id,
            "estado_nuevo": subtarea.estado,
            "progreso": _progreso(tarea),
            "activo": bool(subtarea.activo),
        },
    )
