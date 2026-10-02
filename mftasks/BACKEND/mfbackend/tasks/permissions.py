from rest_framework.permissions import BasePermission

from usuarios.permissions import (
    es_administrador,
    es_cliente,
    ids_equipos_visibles,
    es_lider_del_equipo,
)
from usuarios.jerarquia import rol_efectivo, cadena_aprobacion
from usuarios.models import EquipoMiembro
from usuarios.permissions import es_cliente as _es_cliente
from campanas.models import PermisoCampana



def es_miembro_del_equipo(user, equipo):

    if not user or not user.is_authenticated or equipo is None:
        return False

    if es_administrador(user):
        return True

    # CLIENTE nunca es miembro de equipo
    if es_cliente(user):
        return False

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

    El rol global (GERENTE, SUBGERENTE, JEFE, GTR, ASIGNADOR)
    no concede permisos de gestión por sí solo.
    """

    if not user or not user.is_authenticated or equipo is None:
        return False

    # Administrador puede gestionar cualquier equipo
    if user.roles.filter(
        rol__nombre__iexact="Administrador"
    ).exists():
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
    if user.roles.filter(rol__nombre__iexact="Administrador").exists():
        return True
    if equipo.lider_id == user.id:
        return True
    return False


def es_cliente(user):
    return _es_cliente(user)


def puede_observar_tarea(user, tarea):
    """Mismos criterios de visibilidad que TaskViewSet.get_queryset."""
    if not user or not user.is_authenticated:
        return False

    if es_administrador(user):
        return True

    # CLIENTE: solo sus propias solicitudes
    if es_cliente(user):
        return tarea.solicitante_id == user.id

    return tarea.equipo_id in ids_equipos_visibles(user)


def tiene_permiso_subcampana(user, subcampana):
    """Verifica permiso puntual a subcampaña para cliente. Admin respeta activo."""
    if not user or not user.is_authenticated or subcampana is None:
        return False
    if not subcampana.activo or not subcampana.campana.activo:
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


class EsMiembroDelEquipoDeTarea(BasePermission):

    def has_object_permission(self, request, view, obj):
        return es_miembro_del_equipo(request.user, obj.equipo)


class EsAsignadorDeEquipoDeTarea(BasePermission):

    def has_object_permission(self, request, view, obj):
        return es_asignador_del_equipo(request.user, obj.equipo)


class EsCliente(BasePermission):

    def has_permission(self, request, view):
        return es_cliente(request.user)


class EsSolicitanteDeTarea(BasePermission):

    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False
        if es_administrador(request.user):
            return True
        return obj.solicitante_id == request.user.id


def es_aprobador_de_tarea(user, tarea):
    """
    Determina si el usuario puede aprobar la tarea según
    la jerarquía organizacional.

    APROBADORES:
        Puede aprobar un usuario cuyo rol sea superior al
        rol del equipo de la tarea.

    LIDER:
        Solo el líder del equipo.

    Administrador:
        Puede actuar como override.

    EquipoAprobador NO participa en esta autorización.
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
        return es_lider_del_equipo(user, equipo)

    # =========================================================
    # FASE APROBACIÓN JERÁRQUICA
    # =========================================================
    if paso == "APROBADORES":

        
        rol_usuario = rol_efectivo(user)

        if rol_usuario is None:
            return False

        rol_equipo = getattr(
            equipo,
            "rol_equipo",
            None,
        )

        if rol_equipo is None:
            return False

        superiores = cadena_aprobacion(
            rol_equipo
        )

        ids_superiores = {
            rol.pk
            for rol in superiores
            if rol.activo
        }

        # El usuario debe ser superior al rol del equipo.
        if rol_usuario.pk not in ids_superiores:
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
        is_member = equipo.lider_id == request.user.id or equipo.miembros.filter(usuario=request.user).exists()
        return is_member
