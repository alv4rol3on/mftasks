from django.db.models import Q
from django.utils import timezone


def filtro_no_disponible(prefix="usuario", fecha=None):
    """Q que identifica usuarios con indisponibilidad vigente."""
    fecha = fecha or timezone.localdate()
    return (
        Q(**{f"{prefix}__disponibilidad__estado": "INDISPONIBLE"})
        & (
            Q(**{f"{prefix}__disponibilidad__fecha_inicio__isnull": True})
            | Q(**{f"{prefix}__disponibilidad__fecha_inicio__lte": fecha})
        )
        & (
            Q(**{f"{prefix}__disponibilidad__fecha_fin__isnull": True})
            | Q(**{f"{prefix}__disponibilidad__fecha_fin__gte": fecha})
        )
    )


def excluir_no_disponibles(queryset, prefix="usuario", fecha=None):
    return queryset.exclude(filtro_no_disponible(prefix, fecha))


def esta_disponible(usuario, fecha=None):
    if usuario is None:
        return False

    try:
        disponibilidad = usuario.disponibilidad
    except Exception:
        return True

    return disponibilidad.esta_disponible(fecha)


def subtareas_pendientes_usuario(usuario):
    """Subtareas activas no solucionadas de tareas en desarrollo."""
    from tasks.models import Subtarea, Tarea

    if usuario is None:
        return Subtarea.objects.none()

    return (
        Subtarea.objects.filter(
            asignado=usuario,
            activo=True,
            tarea__estado=Tarea.Estado.EN_DESARROLLO,
        )
        .exclude(estado=Subtarea.Estado.SOLUCIONADO)
        .select_related("tarea")
        .order_by("tarea_id", "id")
    )


def serializar_subtareas_pendientes(subtareas):
    return [
        {
            "id": subtarea.id,
            "codigo": subtarea.codigo,
            "descripcion": subtarea.descripcion,
            "estado": subtarea.estado,
            "tarea_id": subtarea.tarea_id,
            "tarea_ticket": subtarea.tarea.ticket,
            "tarea_asunto": subtarea.tarea.asunto,
        }
        for subtarea in subtareas
    ]
