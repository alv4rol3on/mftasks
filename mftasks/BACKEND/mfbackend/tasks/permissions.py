from rest_framework.permissions import BasePermission

from usuarios.permissions import (
    es_administrador,
    ids_equipos_visibles,
    es_lider_del_equipo,
    es_aprobador_del_equipo,
)
from usuarios.jerarquia import nivel_efectivo, cadena_aprobacion
from usuarios.models import EquipoMiembro
from campanas.models import PermisoCampana



def es_miembro_del_equipo(user, equipo):

    if not user or not user.is_authenticated or equipo is None:
        return False

    if es_administrador(user):
        return True

    # Visibilidad jerárquica directa: propios + equipos de sus integrantes directos.
    return equipo.id in ids_equipos_visibles(user)


def es_sub_lider(user, equipo):
    if not user or not user.is_authenticated or equipo is None:
        return False

    

    return EquipoMiembro.objects.filter(
        equipo=equipo,
        usuario=user,
        rol_en_equipo=EquipoMiembro.RolEnEquipo.SUB_LIDER,
        estado=EquipoMiembro.EstadoMiembro.ACTIVO,
    ).exists()

def es_lider_por_miembro(user, equipo):
    if not user or not user.is_authenticated or equipo is None:
        return False

    if equipo.lider_id == user.id:
        return True

    return EquipoMiembro.objects.filter(
        equipo=equipo,
        usuario=user,
        rol_en_equipo=EquipoMiembro.RolEnEquipo.LIDER,
        estado=EquipoMiembro.EstadoMiembro.ACTIVO,
    ).exists()


def es_asignador_del_equipo(user, equipo):
    """
    Determina si el usuario puede gestionar tareas dentro de ESTE equipo.

    Permisos:
    - Administrador: cualquier equipo.
    - Líder del equipo: su equipo.
    - Sub-líder activo: su equipo.
    - Miembro: no puede gestionar.

    El nivel global del usuario no concede permisos de gestión por sí solo.
    """

    if not user or not user.is_authenticated or equipo is None:
        return False

    # Administrador puede gestionar cualquier equipo
    if es_administrador(user):
        return True

    # Líder real de ESTE equipo
    if equipo.lider_id == user.id:
        return True

    # Sub-líder de ESTE equipo
    return EquipoMiembro.objects.filter(
        equipo=equipo,
        usuario=user,
        rol_en_equipo=EquipoMiembro.RolEnEquipo.SUB_LIDER,
        estado=EquipoMiembro.EstadoMiembro.ACTIVO,
    ).exists()


def puede_gestionar_roles_equipo(user, equipo):
    """Solo líder y admin pueden administrar roles/estados (sub-líder no)."""
    if not user or not user.is_authenticated:
        return False
    if es_administrador(user):
        return True
    if equipo.lider_id == user.id:
        return True
    return False


def puede_observar_tarea(user, tarea):
    """Mismos criterios de visibilidad que TaskViewSet.get_queryset."""
    if not user or not user.is_authenticated:
        return False

    if es_administrador(user):
        return True

    # El solicitante siempre puede observar su propia solicitud.
    if tarea.solicitante_id == user.id:
        return True

    if tarea.equipo_id in ids_equipos_visibles(user):
        return True

    # Aprobador jerárquico del equipo (incluye equipos con autoaprobación).
    if es_aprobador_del_equipo(user, tarea.equipo):
        return tiene_permiso_subcampana(user, tarea.subcampana)

    return False


def tiene_permiso_subcampana(user, subcampana):
    """Verifica permiso puntual a subcampaña para cliente. Admin respeta activo."""
    if not user or not user.is_authenticated or subcampana is None:
        return False
    campana = subcampana.campana
    entidad = campana.entidad
    if (
        not subcampana.activo
        or subcampana.eliminado
        or not campana.activo
        or campana.eliminado
        or not entidad.activo
        or entidad.eliminado
    ):
        return False
    if es_administrador(user):
        return True
    # solo permiso directo a subcampana puntual
    if PermisoCampana.objects.filter(usuario=user, subcampana=subcampana).exists():
        return True
    return False


def puede_ver_tarea_completa(user, equipo):
    """Asignador, lider o admin pueden ver tarea completa; asistente solo sus subtareas."""
    if es_asignador_del_equipo(user, equipo):
        return True
    return False


def puede_resolver_reapertura(user, tarea):
    """Admin, líder o sub-líder activo del equipo pueden aprobar/rechazar reaperturas."""
    if not user or not user.is_authenticated or tarea is None:
        return False
    if es_administrador(user):
        return True
    equipo = getattr(tarea, "equipo", None)
    if equipo is None:
        return False
    return es_asignador_del_equipo(user, equipo)


class EsMiembroDelEquipoDeTarea(BasePermission):

    def has_object_permission(self, request, view, obj):
        return es_miembro_del_equipo(request.user, obj.equipo)


class EsAsignadorDeEquipoDeTarea(BasePermission):

    def has_object_permission(self, request, view, obj):
        return es_asignador_del_equipo(request.user, obj.equipo)


class EsSolicitanteDeTarea(BasePermission):

    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False
        if es_administrador(request.user):
            return True
        return obj.solicitante_id == request.user.id


def niveles_superiores_de_tarea(tarea):
    """IDs de niveles activos que forman la cadena de aprobación de la tarea.

    Es la cadena de superiores del nivel del equipo (superior directo -> raíz).
    """
    equipo = getattr(tarea, "equipo", None)
    if equipo is None:
        return set()
    nivel_equipo = getattr(equipo, "nivel", None)
    if nivel_equipo is None:
        return set()
    return {
        nivel.pk
        for nivel in cadena_aprobacion(nivel_equipo)
        if nivel.activo
    }


def usuarios_aprobadores_de_tarea(tarea):
    """Usuarios elegibles para aprobar la fase APROBADORES de la tarea.

    Elegible = activo, su nivel efectivo pertenece a la cadena de superiores del
    equipo y tiene permiso a la subcampaña de la tarea. No depende de
    asignaciones por equipo: los aprobadores se derivan de la jerarquía.
    """
    from usuarios.models import User

    ids_niveles = niveles_superiores_de_tarea(tarea)
    if not ids_niveles:
        return []

    subcampana = getattr(tarea, "subcampana", None)

    candidatos = (
        User.objects
        .filter(niveles__nivel_id__in=ids_niveles, is_active=True)
        .distinct()
    )

    elegibles = []
    for usuario in candidatos:
        nivel = nivel_efectivo(usuario)
        if nivel is None or nivel.pk not in ids_niveles:
            continue
        if not tiene_permiso_subcampana(usuario, subcampana):
            continue
        elegibles.append(usuario)

    return elegibles


def hay_aprobadores_con_permiso(tarea):
    """True si existe al menos un aprobador elegible para la tarea."""
    return bool(usuarios_aprobadores_de_tarea(tarea))


def es_aprobador_de_tarea(user, tarea):
    """
    Determina si el usuario puede aprobar la tarea según
    la jerarquía organizacional.

    APROBADORES:
        Puede aprobar un usuario cuyo nivel sea superior al
        nivel del equipo de la tarea y tenga permiso a la subcampaña.

    LIDER:
        Solo el líder del equipo. Cuando el nivel del equipo tiene
        autoaprobación, los superiores NO pueden intervenir en esta fase.

    Administrador:
        Puede actuar como override.

    No existen aprobadores asignados por equipo: toda la cadena de niveles
    superiores que cumpla con el permiso a la subcampaña puede aprobar.
    """

    if not user or not user.is_authenticated or tarea is None:
        return False

    if es_administrador(user):
        return True

    equipo = getattr(tarea, "equipo", None)

    if equipo is None:
        return False

    paso = getattr(tarea, "paso_aprobacion", None)

    # =========================================================
    # FASE LÍDER
    # =========================================================
    if paso == "LIDER":
        # Con autoaprobación la solicitud nace directamente en revisión del
        # líder y los superiores no pueden aprobar ni rechazar.
        return es_lider_del_equipo(user, equipo)

    # =========================================================
    # FASE APROBACIÓN JERÁRQUICA
    # =========================================================
    if paso == "APROBADORES":

        nivel_usuario = nivel_efectivo(user)

        if nivel_usuario is None:
            return False

        # El nivel efectivo del usuario debe ser superior al nivel del equipo.
        if nivel_usuario.pk not in niveles_superiores_de_tarea(tarea):
            return False

        # Debe tener acceso a la subcampaña.
        if not tiene_permiso_subcampana(
            user,
            getattr(tarea, "subcampana", None),
        ):
            return False

        return True

    return False
class PuedeAprobarPasoDeTarea(BasePermission):

    def has_object_permission(self, request, view, obj):
        return es_aprobador_de_tarea(request.user, obj)


class EsAsignadoDeSubtarea(BasePermission):

    def has_object_permission(self, request, view, obj):
        # obj es Subtarea - asignador/asistente pueden completar solo si es su equipo y está asignada a él
        # Administrador nunca puede (según requerimiento corregido)
        if not request.user or not request.user.is_authenticated:
            return False
        if es_administrador(request.user):
            return False
        if obj.asignado_id != request.user.id:
            return False
        try:
            equipo = obj.tarea.equipo
        except Exception:
            return False
        is_member = (
            equipo.lider_id == request.user.id
            or equipo.miembros.filter(
                usuario=request.user,
                estado=EquipoMiembro.EstadoMiembro.ACTIVO,
            ).exists()
        )

        return is_member
