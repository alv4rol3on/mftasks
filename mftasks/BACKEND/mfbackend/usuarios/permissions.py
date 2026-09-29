from rest_framework.permissions import BasePermission, IsAuthenticated

from .jerarquia import nivel_efectivo
from usuarios.models import (
    Equipo,
    EquipoAprobador,
    EquipoMiembro
)


class IsAuthenticatedActivo(IsAuthenticated):

    def has_permission(self, request, view):

        if not super().has_permission(request, view):
            return False

        return request.user.is_active


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


def tiene_rol(user, nombre):
    """Indica si el usuario posee el rol indicado (case-insensitive)."""
    if not user or not user.is_authenticated or not nombre:
        return False
    return user.roles.filter(rol__nombre__iexact=nombre).exists()


def es_lider_del_equipo(user, equipo):
    """True si el usuario es líder de ESE equipo (FK o miembro LIDER activo)."""
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


def es_lider_de_equipo(user, equipo):
    if not user or not user.is_authenticated:
        return False
    return equipo.lider_id == user.id


def es_sub_lider_de_equipo(user, equipo):
    if not user or not user.is_authenticated or equipo is None:
        return False

    return EquipoMiembro.objects.filter(
        equipo=equipo,
        usuario=user,
        rol_en_equipo=EquipoMiembro.RolEnEquipo.SUB_LIDER,
        estado=EquipoMiembro.EstadoMiembro.ACTIVO,
    ).exists()


def es_lider_global(user):
    if not user or not user.is_authenticated:
        return False
    return user.roles.filter(rol__nombre__iexact="GTR").exists()


def es_lider_miembro(user, equipo):
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


def puede_operar_como_lider(user, equipo):
    if not user or not user.is_authenticated or equipo is None:
        return False

    # Administrador
    if user.roles.filter(
        rol__nombre__iexact="Administrador"
    ).exists():
        return True

    # Líder de ESTE equipo
    if equipo.lider_id == user.id:
        return True

    # Sub-líder de ESTE equipo
    return EquipoMiembro.objects.filter(
        equipo=equipo,
        usuario=user,
        rol_en_equipo=EquipoMiembro.RolEnEquipo.SUB_LIDER,
        estado=EquipoMiembro.EstadoMiembro.ACTIVO,
    ).exists()


def es_miembro_activo(user, equipo):
    if not user or not user.is_authenticated:
        return False
    # CLIENTE nunca cuenta como miembro de equipo (incluso si es admin+cliente, admin ya gestiona aparte)
    if user.roles.filter(rol__nombre__iexact="CLIENTE").exists() and not user.roles.filter(rol__nombre__iexact="Administrador").exists():
        return False
    if equipo.lider_id == user.id:
        return True
    return equipo.miembros.filter(usuario=user).exclude(estado=EquipoMiembro.EstadoMiembro.INACTIVO).exists()


def puede_gestionar_miembros(user, equipo):
    """Solo líder (FK) y administrador pueden administrar roles/estados. Miembro GTR también."""
    if es_administrador(user):
        return True
    if es_lider_miembro(user, equipo):
        return True
    return False


def puede_ser_lider(user):
    """True si el usuario puede liderar un equipo (rol elegible o admin)."""
    return es_administrador(user) or nivel_efectivo(user) is not None


def ids_equipos_visibles(user):
    """IDs de equipos visibles para el usuario.

    - Admin: todos los equipos.
    - Resto: solo los equipos donde es líder o miembro activo.
    """
    if not user or not user.is_authenticated:
        return set()
    if es_administrador(user):
        return set(Equipo.objects.values_list("id", flat=True))


    propios = set(
        Equipo.objects.filter(lider=user).values_list("id", flat=True)
    )
    propios |= set(
        EquipoMiembro.objects.filter(
            usuario=user,
            estado=EquipoMiembro.EstadoMiembro.ACTIVO,
        ).values_list("equipo_id", flat=True)
    )
    # Aprobadores asignados: ven todo el proceso de las solicitudes del equipo.
    propios |= set(
        EquipoAprobador.objects.filter(
            usuario=user,
        ).values_list("equipo_id", flat=True)
    )
    return propios


def es_aprobador_asignado(user, equipo):
    """True si el usuario es un aprobador asignado del equipo."""
    if not user or not user.is_authenticated or equipo is None:
        return False
    return EquipoAprobador.objects.filter(
        equipo=equipo,
        usuario=user,
    ).exists()


class PuedeCrearEquipo(BasePermission):
    """Administrador o usuario con rol elegible (no MIEMBRO/CLIENTE)."""

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if not request.user.is_active:
            return False
        return puede_ser_lider(request.user)


class EsLiderDeEquipo(BasePermission):

    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.is_active

    def has_object_permission(self, request, view, obj):
        equipo = obj if isinstance(obj, Equipo) else getattr(obj, "equipo", None)
        if equipo is None:
            return False
        return puede_gestionar_miembros(request.user, equipo)
