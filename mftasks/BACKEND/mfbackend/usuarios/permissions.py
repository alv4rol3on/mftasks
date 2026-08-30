from rest_framework.permissions import BasePermission, IsAuthenticated


class IsAuthenticatedActivo(IsAuthenticated):

    def has_permission(self, request, view):

        if not super().has_permission(request, view):
            return False

        return request.user.activo


class EsAdministrador(BasePermission):

    def has_permission(self, request, view):

        if not request.user or not request.user.is_authenticated:
            return False

        return request.user.roles.filter(
            rol__nombre__iexact="Administrador"
        ).exists()


def es_administrador(user):
    if not user or not user.is_authenticated:
        return False
    return user.roles.filter(rol__nombre__iexact="Administrador").exists()


def es_lider_de_equipo(user, equipo):
    if not user or not user.is_authenticated:
        return False
    return equipo.lider_id == user.id


def es_sub_lider_de_equipo(user, equipo):
    # Compatibilidad Fase 0: SUB_LIDER deprecado, ahora LIDER es único rol de gestión
    if not user or not user.is_authenticated:
        return False
    from .models import EquipoMiembro
    return EquipoMiembro.objects.filter(
        equipo=equipo,
        usuario=user,
        rol_en_equipo__in=[EquipoMiembro.RolEnEquipo.SUB_LIDER, EquipoMiembro.RolEnEquipo.LIDER],
        estado=EquipoMiembro.EstadoMiembro.ACTIVO,
    ).exists()


def es_lider_miembro(user, equipo):
    """Lider por EquipoMiembro LIDER activo (no solo FK lider_id)"""
    if not user or not user.is_authenticated:
        return False
    from .models import EquipoMiembro
    if equipo.lider_id == user.id:
        return True
    return EquipoMiembro.objects.filter(
        equipo=equipo,
        usuario=user,
        rol_en_equipo=EquipoMiembro.RolEnEquipo.LIDER,
        estado=EquipoMiembro.EstadoMiembro.ACTIVO,
    ).exists()


def puede_operar_como_lider(user, equipo):
    """Lider (FK o miembro LIDER) puede operar como lider. Fase 1: solo 4 roles."""
    if es_administrador(user):
        return True
    if es_lider_miembro(user, equipo):
        return True
    # compat: viejo SUB_LIDER o rol global ASIGNADOR todavía permitido hasta migración 0012
    if es_sub_lider_de_equipo(user, equipo):
        return True
    if user.roles.filter(rol__nombre__iexact="ASIGNADOR").exists() and es_miembro_activo(user, equipo):
        return True
    return False


def es_miembro_activo(user, equipo):
    if not user or not user.is_authenticated:
        return False
    from .models import EquipoMiembro
    if equipo.lider_id == user.id:
        return True
    return equipo.miembros.filter(usuario=user).exclude(estado=EquipoMiembro.EstadoMiembro.INACTIVO).exists()


def puede_gestionar_miembros(user, equipo):
    """Solo líder (FK) y administrador pueden administrar roles/estados. Miembro LIDER también."""
    if es_administrador(user):
        return True
    if es_lider_miembro(user, equipo):
        return True
    return False


class EsLiderDeEquipo(BasePermission):

    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.activo

    def has_object_permission(self, request, view, obj):
        from .models import Equipo
        equipo = obj if isinstance(obj, Equipo) else getattr(obj, "equipo", None)
        if equipo is None:
            return False
        return puede_gestionar_miembros(request.user, equipo)