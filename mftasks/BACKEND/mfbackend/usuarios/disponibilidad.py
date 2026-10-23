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


def sublideres_disponibles_de_equipo(equipo, excluir_usuario_id=None):
    """Sub-líderes activos y disponibles de un equipo."""

    from usuarios.models import EquipoMiembro

    if equipo is None:
        return []

    miembros = (
        EquipoMiembro.objects
        .filter(
            equipo=equipo,
            rol_en_equipo=EquipoMiembro.RolEnEquipo.SUB_LIDER,
            estado=EquipoMiembro.EstadoMiembro.ACTIVO,
            usuario__is_active=True,
        )
        .select_related("usuario", "usuario__disponibilidad")
    )

    if excluir_usuario_id is not None:
        miembros = miembros.exclude(usuario_id=excluir_usuario_id)

    return [
        miembro.usuario
        for miembro in miembros
        if esta_disponible(miembro.usuario)
    ]


def equipos_liderados_sin_sublider(usuario):
    """Equipos activos liderados por el usuario sin sub-líder disponible."""

    from usuarios.models import Equipo

    if usuario is None or not getattr(usuario, "is_authenticated", False):
        return []

    equipos = Equipo.objects.filter(lider=usuario, activo=True).order_by("nombre")

    return [
        equipo
        for equipo in equipos
        if not sublideres_disponibles_de_equipo(equipo)
    ]


def equipos_donde_es_ultimo_sublider_disponible(usuario):
    """Equipos con líder ausente donde el usuario es el último sub-líder."""

    from usuarios.models import Equipo, EquipoMiembro

    if usuario is None or not getattr(usuario, "is_authenticated", False):
        return []

    equipos = (
        Equipo.objects
        .filter(
            activo=True,
            miembros__usuario=usuario,
            miembros__rol_en_equipo=EquipoMiembro.RolEnEquipo.SUB_LIDER,
            miembros__estado=EquipoMiembro.EstadoMiembro.ACTIVO,
        )
        .distinct()
        .order_by("nombre")
    )

    resultado = []

    for equipo in equipos:
        if esta_disponible(equipo.lider):
            continue

        if sublideres_disponibles_de_equipo(
            equipo,
            excluir_usuario_id=usuario.id,
        ):
            continue

        resultado.append(equipo)

    return resultado


def serializar_equipos(equipos):
    return [
        {"id": equipo.id, "nombre": equipo.nombre}
        for equipo in equipos
    ]
