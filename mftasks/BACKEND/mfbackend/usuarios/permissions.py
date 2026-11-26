from rest_framework.permissions import BasePermission, IsAuthenticated

from .jerarquia import puede_ser_lider as _puede_ser_lider
from usuarios.models import Equipo, EquipoMiembro


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

    Se acepta también el nivel de sistema heredado "Administrador".
    """
    if not user or not user.is_authenticated:
        return False
    from .models import TipoUsuario

    if getattr(user, "tipo_usuario", None) == TipoUsuario.ADMINISTRADOR:
        return True
    return user.niveles.filter(nivel__es_sistema=True).exists()


def puede_crear_solicitudes(user):
    """True si el usuario puede crear solicitudes y ver 'Mis solicitudes'."""
    if not user or not user.is_authenticated:
        return False
    if es_administrador(user):
        return True
    return bool(getattr(user, "puede_crear_solicitudes", False))


def es_equipo_propio(user, equipo):
    """True si el usuario lidera o pertenece activamente al equipo."""
    if not user or not user.is_authenticated or equipo is None:
        return False
    if equipo.lider_id == user.id:
        return True
    return EquipoMiembro.objects.filter(
        equipo=equipo,
        usuario=user,
        estado=EquipoMiembro.EstadoMiembro.ACTIVO,
    ).exists()


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

    if es_administrador(user):
        return True
    if equipo.lider_id == user.id:
        return True

    return EquipoMiembro.objects.filter(
        equipo=equipo,
        usuario=user,
        rol_en_equipo=EquipoMiembro.RolEnEquipo.SUB_LIDER,
        estado=EquipoMiembro.EstadoMiembro.ACTIVO,
    ).exists()


def es_miembro_activo(user, equipo):
    if not user or not user.is_authenticated:
        return False
    if equipo.lider_id == user.id:
        return True
    return equipo.miembros.filter(usuario=user).exclude(
        estado=EquipoMiembro.EstadoMiembro.INACTIVO
    ).exists()


def puede_gestionar_miembros(user, equipo):
    """Solo líder (FK) y administrador pueden administrar roles/estados."""
    if es_administrador(user):
        return True
    if es_lider_miembro(user, equipo):
        return True
    return False


def puede_ser_lider(user):
    """True si el usuario puede liderar un equipo (nivel elegible)."""
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
    """True si el nivel efectivo del usuario es un superior del nivel del equipo."""
    if not user or not user.is_authenticated or equipo is None:
        return False
    if es_administrador(user):
        return True

    from .jerarquia import cadena_aprobacion, nivel_efectivo

    nivel_usuario = nivel_efectivo(user)
    if nivel_usuario is None:
        return False

    nivel_equipo = getattr(equipo, "nivel", None)
    if nivel_equipo is None:
        return False

    return nivel_usuario.pk in {
        nivel.pk for nivel in cadena_aprobacion(nivel_equipo) if nivel.activo
    }


def ids_equipos_aprobables(user):
    """IDs de equipos cuyas solicitudes el usuario puede aprobar por jerarquía."""
    if not user or not user.is_authenticated:
        return set()
    if es_administrador(user):
        return set(Equipo.objects.values_list("id", flat=True))

    from .jerarquia import nivel_efectivo, niveles_subordinados

    nivel = nivel_efectivo(user)
    if nivel is None:
        return set()

    ids_niveles = {n.pk for n in niveles_subordinados(nivel) if n.activo}
    if not ids_niveles:
        return set()

    return set(
        Equipo.objects
        .filter(nivel_id__in=ids_niveles)
        .values_list("id", flat=True)
    )


def es_aprobador_organizacional(user):
    """True si el usuario puede aprobar solicitudes según la jerarquía."""
    if not user or not user.is_authenticated:
        return False
    if es_administrador(user):
        return False

    from .jerarquia import cadena_aprobacion, nivel_efectivo

    nivel = nivel_efectivo(user)
    if nivel is None:
        return False

    if not user.permisos_campana.exists():
        return False

    for equipo in Equipo.objects.filter(activo=True).select_related("nivel"):
        if equipo.nivel is None:
            continue
        if nivel.pk in {n.pk for n in cadena_aprobacion(equipo.nivel)}:
            return True

    return False


class PuedeCrearEquipo(BasePermission):
    """Colaborador con un nivel que tenga el permiso de liderar."""

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
