"""Jerarquía organizacional dinámica basada en relaciones de aprobación.

El orden jerárquico NO se almacena ni se codifica: se deriva recorriendo la
relación `Rol.superior`. Cada rol (salvo la raíz) tiene exactamente un superior
directo; la cadena completa de aprobadores se calcula en código y nunca se
persiste.

Este módulo importa los modelos de forma diferida (dentro de las funciones)
para evitar imports circulares.
"""

# Etiquetas de las fases del flujo de aprobación de una tarea.
NOMBRES_ROL = {
    "APROBADORES": "Aprobadores",
    "LIDER": "Revisión del líder",
    "COMPLETADO": "Completado",
}

# Nombre de rol de respaldo cuando no hay información jerárquica disponible.
ROL_INTEGRANTE_DEFECTO = "MIEMBRO"


def get_rol(valor):
    """Resuelve un Rol a partir de un nombre, de un Rol o de None."""
    from .models import Rol

    if valor is None:
        return None
    if isinstance(valor, Rol):
        return valor
    return Rol.objects.filter(nombre__iexact=str(valor).strip()).first()


def cadena_aprobacion(rol):
    """Cadena de superiores de un rol (directo -> ... -> raíz).

    No incluye al propio rol. Se calcula en memoria; no se almacena.
    """
    from .models import Rol

    rol = get_rol(rol)
    if rol is None:
        return []

    cadena = []
    visitados = {rol.pk}
    actual = rol.superior
    while actual is not None:
        if actual.pk in visitados:
            # Protección ante datos corruptos (no debería ocurrir por clean()).
            break
        cadena.append(actual)
        visitados.add(actual.pk)
        actual = actual.superior
    return cadena


def profundidad(rol):
    """Número de superiores de un rol (0 = raíz). Posición derivada, no almacenada."""
    return len(cadena_aprobacion(rol))


def rol_efectivo(user):
    """Rol de mayor rango del usuario (el de menor profundidad).

    Devuelve un objeto Rol o None si el usuario no posee roles activos.
    """
    if not user or not user.is_authenticated:
        return None

    roles = [
        ur.rol
        for ur in user.roles.select_related("rol").all()
        if ur.rol and ur.rol.activo
    ]
    if not roles:
        return None

    # Menor profundidad = mayor rango. Desempate determinista por nombre.
    return sorted(roles, key=lambda r: (profundidad(r), r.nombre.upper()))[0]


def nivel_efectivo(user):
    """Compatibilidad: nombre del rol de mayor rango del usuario."""
    rol = rol_efectivo(user)
    return rol.nombre if rol else None


def puede_ser_lider(user):
    """True si el usuario puede liderar un equipo.

    Lo determina el tipo de usuario (Administrador) o un rol con
    `puede_liderar=True`; nunca por nombres codificados.
    """
    from .models import TipoUsuario

    if not user or not user.is_authenticated:
        return False
    if getattr(user, "tipo_usuario", None) == TipoUsuario.ADMINISTRADOR:
        return True
    if user.roles.filter(rol__nombre__iexact="Administrador").exists():
        return True
    rol = rol_efectivo(user)
    return bool(rol and rol.puede_liderar)


def tipo_equipo_para(user):
    """Compatibilidad: nombre del rol del líder."""
    rol = rol_efectivo(user)
    return rol.nombre if rol else "GTR"


def _rol_de_equipo(equipo):
    from .models import Equipo

    if equipo is None:
        return None
    if not isinstance(equipo, Equipo):
        return get_rol(equipo)
    rol = getattr(equipo, "rol_equipo", None)
    if rol is None:
        # Compatibilidad con datos previos a la migración.
        rol = get_rol(getattr(equipo, "tipo_equipo", None))
    return rol


def roles_aprobador_de_equipo(equipo):
    """Roles de la cadena de aprobación de un equipo (lista de Rol)."""
    return cadena_aprobacion(_rol_de_equipo(equipo))


def roles_aprobador_para(valor):
    """Compatibilidad: nombres de los roles aprobadores.

    Acepta un nombre de rol, un objeto Rol o un objeto Equipo.
    """
    from .models import Equipo

    if isinstance(valor, Equipo):
        return [r.nombre for r in roles_aprobador_de_equipo(valor)]
    return [r.nombre for r in cadena_aprobacion(get_rol(valor))]


def roles_integrante_requeridos(equipo):
    """Roles hijos directos del rol del líder (roles cuyo superior es rol_equipo)."""
    from .models import Rol

    rol = _rol_de_equipo(equipo)
    if rol is None:
        return []
    return list(Rol.objects.filter(superior=rol, activo=True))


def rol_integrante_requerido(valor):
    """Compatibilidad: nombre del primer rol integrante requerido.

    Acepta un nombre de rol, un objeto Rol o un objeto Equipo.
    """
    from .models import Equipo, Rol

    if isinstance(valor, Equipo) or not isinstance(valor, Rol):
        roles = roles_integrante_requeridos(valor)
    else:
        roles = list(Rol.objects.filter(superior=valor, activo=True))
    return roles[0].nombre if roles else ROL_INTEGRANTE_DEFECTO


def nombre_nivel(nivel):
    """Etiqueta legible de una fase de aprobación."""
    return NOMBRES_ROL.get(nivel, nivel)
