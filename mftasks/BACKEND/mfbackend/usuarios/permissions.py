from rest_framework.permissions import BasePermission, IsAuthenticated

from .jerarquia import puede_ser_lider as _puede_ser_lider
from usuarios.models import (
    Equipo,
    EquipoMiembro
)


class IsAuthenticatedActivo(IsAuthenticated):

    def has_permission(self, request, view):

        if not super().has_permission(request, view):
            return False

        return request.user.is_active


class EsAdministrador(BasePermission):

    def has_permission(self, request, view):
        return es_administrador(request.user)


def es_administrador(user):
    """True si el usuario es ADMINISTRADOR (tipo_usuario).

    Compatibilidad temporal: también acepta el rol heredado "Administrador".
    """
    if not user or not user.is_authenticated:
        return False
    from .models import TipoUsuario

    if getattr(user, "tipo_usuario", None) == TipoUsuario.ADMINISTRADOR:
        return True
    return user.roles.filter(rol__nombre__iexact="Administrador").exists()


def es_cliente(user):
    """True si el usuario es CLIENTE (tipo_usuario).

    Compatibilidad temporal: también acepta el rol heredado "Cliente".
    """
    if not user or not user.is_authenticated:
        return False
    from .models import TipoUsuario

    if getattr(user, "tipo_usuario", None) == TipoUsuario.CLIENTE:
        return True
    return user.roles.filter(rol__nombre__iexact="Cliente").exists()


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
    if es_administrador(user):
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
    if es_cliente(user) and not es_administrador(user):
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
    return _puede_ser_lider(user)


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
    return propios


def es_aprobador_del_equipo(user, equipo):
    """True si el rol efectivo del usuario es un superior del rol del equipo.

    El usuario puede aprobar las solicitudes de ese equipo según la jerarquía.
    """
    if not user or not user.is_authenticated or equipo is None:
        return False
    if es_administrador(user):
        return True

    from .jerarquia import rol_efectivo, cadena_aprobacion

    rol_usuario = rol_efectivo(user)
    if rol_usuario is None:
        return False

    rol_equipo = getattr(equipo, "rol_equipo", None)
    if rol_equipo is None:
        return False

    return rol_usuario.pk in {
        rol.pk for rol in cadena_aprobacion(rol_equipo) if rol.activo
    }


def ids_equipos_aprobables(user):
    """IDs de equipos cuyas solicitudes el usuario puede aprobar por jerarquía.

    Son los equipos cuyo `rol_equipo` está por debajo del rol efectivo del
    usuario. No incluye los equipos propios (para esos el usuario es líder).
    """
    if not user or not user.is_authenticated:
        return set()
    if es_administrador(user):
        return set(Equipo.objects.values_list("id", flat=True))

    from .jerarquia import rol_efectivo, roles_subordinados

    rol = rol_efectivo(user)
    if rol is None:
        return set()

    ids_roles = {r.pk for r in roles_subordinados(rol) if r.activo}
    if not ids_roles:
        return set()

    return set(
        Equipo.objects
        .filter(rol_equipo_id__in=ids_roles)
        .values_list("id", flat=True)
    )


def es_aprobador_organizacional(user):
    """True si el usuario puede aprobar solicitudes según la jerarquía.

    No existen aprobadores asignados por equipo: un usuario es aprobador si su
    rol efectivo pertenece a la cadena de superiores de algún equipo activo y
    posee al menos un permiso a subcampaña.
    """
    if not user or not user.is_authenticated:
        return False
    if es_administrador(user) or es_cliente(user):
        return False

    from .jerarquia import rol_efectivo, cadena_aprobacion

    rol = rol_efectivo(user)
    if rol is None:
        return False

    if not user.permisos_campana.exists():
        return False

    for equipo in Equipo.objects.filter(activo=True).select_related("rol_equipo"):
        if equipo.rol_equipo is None:
            continue
        if rol.pk in {r.pk for r in cadena_aprobacion(equipo.rol_equipo)}:
            return True

    return False


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
