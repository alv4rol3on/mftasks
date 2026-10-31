from django.db.models import Sum
from django.db.models.functions import Coalesce

from usuarios.disponibilidad import esta_disponible
from usuarios.models import EquipoMiembro

from ..models import Subtarea, Tarea


def _candidatos_equipo(tarea):
    equipo = getattr(tarea, "equipo", None)
    if equipo is None:
        return []

    usuarios = []
    lider = getattr(equipo, "lider", None)
    if lider is not None and lider.is_active and esta_disponible(lider):
        usuarios.append(lider)

    miembros = (
        EquipoMiembro.objects
        .filter(
            equipo=equipo,
            estado=EquipoMiembro.EstadoMiembro.ACTIVO,
            usuario__is_active=True,
        )
        .select_related("usuario", "usuario__disponibilidad")
        .order_by("usuario__nombres", "usuario__apellidos")
    )
    for miembro in miembros:
        usuario = miembro.usuario
        if usuario is None:
            continue
        if any(item.id == usuario.id for item in usuarios):
            continue
        if esta_disponible(usuario):
            usuarios.append(usuario)

    return usuarios


def _carga_actual(usuario):
    total = (
        Subtarea.objects
        .filter(
            asignado=usuario,
            activo=True,
            estado__in=[
                Subtarea.Estado.EN_ESPERA,
                Subtarea.Estado.EN_DESARROLLO,
            ],
            tarea__activo=True,
        )
        .exclude(
            tarea__estado__in=[
                Tarea.Estado.SOLUCIONADO,
                Tarea.Estado.RECHAZADO,
                Tarea.Estado.CANCELADO,
            ]
        )
        .aggregate(total=Coalesce(Sum("peso"), 0))
    )
    return int(total["total"] or 0)


def sugerir_asignaciones(tarea):
    """Sugiere responsables para subtareas activas según disponibilidad y carga."""
    candidatos = _candidatos_equipo(tarea)
    if not candidatos:
        return []

    cargas = {usuario.id: _carga_actual(usuario) for usuario in candidatos}
    virtuales = dict(cargas)

    subtareas = list(
        Subtarea.objects
        .filter(
            tarea=tarea,
            activo=True,
        )
        .exclude(estado=Subtarea.Estado.SOLUCIONADO)
        .select_related("asignado")
        .order_by("id")
    )

    sugerencias = []
    for subtarea in subtareas:
        candidato = min(
            candidatos,
            key=lambda usuario: (
                virtuales.get(usuario.id, 0),
                usuario.nombres,
                usuario.apellidos,
            ),
        )
        sugerencias.append({
            "subtarea_id": subtarea.id,
            "subtarea_codigo": subtarea.codigo,
            "subtarea_descripcion": subtarea.descripcion,
            "asignado_actual": subtarea.asignado_id,
            "asignado_actual_nombre": subtarea.asignado_nombre
            if hasattr(subtarea, "asignado_nombre")
            else f"{subtarea.asignado.nombres} {subtarea.asignado.apellidos}".strip(),
            "sugerido": candidato.id,
            "sugerido_nombre": f"{candidato.nombres} {candidato.apellidos}".strip(),
            "carga_actual": cargas[candidato.id],
            "motivo": "Menor carga entre los miembros disponibles.",
        })
        virtuales[candidato.id] = virtuales.get(candidato.id, 0) + int(subtarea.peso or 0)

    return sugerencias
