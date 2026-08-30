from rest_framework.permissions import BasePermission


def es_miembro_del_equipo(user, equipo):

    if not user or not user.is_authenticated:
        return False

    if user.roles.filter(rol__nombre__iexact="Administrador").exists():
        return True

    if equipo.lider_id == user.id:
        return True

    # solo miembros no inactivos cuentan como miembros activos
    from usuarios.models import EquipoMiembro
    return equipo.miembros.filter(usuario=user).exclude(estado=EquipoMiembro.EstadoMiembro.INACTIVO).exists()


def es_sub_lider(user, equipo):
    # Compat: SUB_LIDER deprecado, ahora LIDER
    if not user or not user.is_authenticated:
        return False
    from usuarios.models import EquipoMiembro
    return equipo.miembros.filter(
        usuario=user,
        rol_en_equipo__in=[EquipoMiembro.RolEnEquipo.SUB_LIDER, EquipoMiembro.RolEnEquipo.LIDER],
        estado=EquipoMiembro.EstadoMiembro.ACTIVO,
    ).exists()


def es_lider_por_miembro(user, equipo):
    if not user or not user.is_authenticated:
        return False
    from usuarios.models import EquipoMiembro
    if equipo.lider_id == user.id:
        return True
    return equipo.miembros.filter(usuario=user, rol_en_equipo=EquipoMiembro.RolEnEquipo.LIDER, estado=EquipoMiembro.EstadoMiembro.ACTIVO).exists()


def es_asignador_del_equipo(user, equipo):
    # Fase 1: lider por-equipo = asignador. Mantiene compat ASIGNADOR global.
    if not user or not user.is_authenticated:
        return False

    if user.roles.filter(rol__nombre__iexact="Administrador").exists():
        return True

    if not es_miembro_del_equipo(user, equipo):
        return False

    if es_lider_por_miembro(user, equipo):
        return True

    if es_sub_lider(user, equipo):
        return True

    # compat: viejo rol ASIGNADOR
    return user.roles.filter(rol__nombre__iexact="ASIGNADOR").exists()


def puede_gestionar_roles_equipo(user, equipo):
    """Solo líder y admin pueden administrar roles/estados (sub-líder no)."""
    if not user or not user.is_authenticated:
        return False
    if user.roles.filter(rol__nombre__iexact="Administrador").exists():
        return True
    if equipo.lider_id == user.id:
        return True
    return False


def es_asistente_puro(user):
    """Retorna True si el usuario tiene rol ASISTENTE y NO es asignador/admin/lider."""
    if not user or not user.is_authenticated:
        return False
    if user.roles.filter(rol__nombre__iexact="Administrador").exists():
        return False
    if user.roles.filter(rol__nombre__iexact="ASIGNADOR").exists():
        return False
    return user.roles.filter(rol__nombre__iexact="ASISTENTE").exists()


def es_solo_asistente(user):
    """Asistente = tiene ASISTENTE o es miembro sin rol ASIGNADOR/Admin y no es líder.
    Se usa para filtrar visibilidad."""
    if not user or not user.is_authenticated:
        return False
    if user.roles.filter(rol__nombre__iexact="Administrador").exists():
        return False
    if user.roles.filter(rol__nombre__iexact="ASIGNADOR").exists():
        return False
    # Si no es admin/asignador, y es miembro de algún equipo, se considera asistente
    # Incluimos quienes tengan rol ASISTENTE explícitamente o simplemente miembros sin privilegios
    return True


def es_cliente(user):
    if not user or not user.is_authenticated:
        return False
    return user.roles.filter(rol__nombre__iexact="CLIENTE").exists()


def tiene_permiso_subcampana(user, subcampana):
    """Verifica permiso mixto campaña/subcampaña para cliente. Admin siempre True."""
    if not user or not user.is_authenticated or subcampana is None:
        return False
    if user.roles.filter(rol__nombre__iexact="Administrador").exists():
        return True
    # cliente con permiso explícito
    from campanas.models import PermisoCampana
    # permiso directo a subcampana
    if PermisoCampana.objects.filter(usuario=user, subcampana=subcampana).exists():
        return True
    # permiso a campana padre
    if PermisoCampana.objects.filter(usuario=user, campana=subcampana.campana).exists():
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
        if request.user.roles.filter(rol__nombre__iexact="Administrador").exists():
            return True
        return obj.solicitante_id == request.user.id


class EsAsignadoDeSubtarea(BasePermission):

    def has_object_permission(self, request, view, obj):
        # obj es Subtarea - asignador/asistente pueden completar solo si es su equipo y está asignada a él
        # Administrador nunca puede (según requerimiento corregido)
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.roles.filter(rol__nombre__iexact="Administrador").exists():
            return False
        if obj.asignado_id != request.user.id:
            return False
        try:
            equipo = obj.tarea.equipo
        except Exception:
            return False
        is_member = equipo.lider_id == request.user.id or equipo.miembros.filter(usuario=request.user).exists()
        return is_member
