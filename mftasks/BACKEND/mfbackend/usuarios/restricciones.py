"""Reglas que restringen la edición de estado/rol de un usuario.

- COLABORADOR: no se puede editar estado/rol si tiene subtareas activas no
  solucionadas o si pertenece a algún equipo.
- CLIENTE: no se puede editar estado/rol si tiene solicitudes no finalizadas.
- ADMINISTRADOR: ya dispone de su propio bloqueo (no se modifica).
"""

from .models import TipoUsuario


def tiene_pendientes(user):
    """True si el usuario tiene subtareas activas no solucionadas."""
    from tasks.models import Subtarea

    return Subtarea.objects.filter(
        asignado=user,
        activo=True,
    ).exclude(
        estado=Subtarea.Estado.SOLUCIONADO,
    ).exists()


def pertenece_a_equipo(user):
    """True si el usuario es miembro (cualquier estado) o líder de algún equipo."""
    from .models import Equipo, EquipoMiembro

    if EquipoMiembro.objects.filter(usuario=user).exists():
        return True
    return Equipo.objects.filter(lider=user).exists()


def tiene_solicitudes_en_proceso(user):
    """True si el usuario (cliente) tiene solicitudes no finalizadas."""
    from tasks.models import Tarea

    return Tarea.objects.filter(
        solicitante=user,
        activo=True,
    ).exclude(
        estado__in=[Tarea.Estado.SOLUCIONADO, Tarea.Estado.RECHAZADO],
    ).exists()


def motivo_bloqueo_estado_rol(user, *, pendientes=None, equipo=None, proceso=None):
    """Devuelve el motivo por el que no se puede editar estado/rol, o None.

    Acepta flags precalculados (p. ej. anotaciones del queryset) para evitar
    consultas adicionales en el listado.
    """
    if user is None:
        return None

    tipo = getattr(user, "tipo_usuario", None)

    if tipo == TipoUsuario.CLIENTE:
        if proceso is None:
            proceso = tiene_solicitudes_en_proceso(user)
        if proceso:
            return "No se puede editar estado/rol: el cliente tiene solicitudes en proceso."
        return None

    if pendientes is None:
        pendientes = tiene_pendientes(user)
    if equipo is None:
        equipo = pertenece_a_equipo(user)

    motivos = []
    if pendientes:
        motivos.append("tiene subtareas pendientes")
    if equipo:
        motivos.append("pertenece a un equipo")

    if motivos:
        return "No se puede editar estado/rol: " + " y ".join(motivos) + "."
    return None
