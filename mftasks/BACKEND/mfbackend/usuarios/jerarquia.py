
"""Jerarquía organizacional de roles y tipos de equipo.

Pirámide de tipos de usuario:
    GERENTE > SUBGERENTE > JEFE > GTR > MIEMBRO

Roles que pueden ser líderes de un equipo: todos menos MIEMBRO/CLIENTE.

El tipo de equipo se deriva del rol del líder:
    EQUIPO DE GERENTE / EQUIPO DE SUBGERENTE / EQUIPO DE JEFE / EQUIPO GTR

Este módulo no importa modelos para evitar imports circulares.
"""

NOMBRES_ROL = {
    "GERENTE": "Gerente",
    "SUBGERENTE": "Subgerente",
    "JEFE": "Jefe",
    "GTR": "GTR",
    "APROBADORES": "Aprobadores",
    "LIDER": "Revisión del líder",
    "COMPLETADO": "Completado",
}

# Roles que pueden ser líderes de un equipo (todos menos MIEMBRO/CLIENTE).
# Orden de mayor a menor jerarquía.
ROLES_LIDER = ("GERENTE", "SUBGERENTE", "JEFE", "GTR")

# Etiquetas del tipo de equipo derivado del rol del líder.
TIPOS_EQUIPO = {
    "GERENTE": "EQUIPO DE GERENTE",
    "SUBGERENTE": "EQUIPO DE SUBGERENTE",
    "JEFE": "EQUIPO DE JEFE",
    "GTR": "EQUIPO GTR",
}

# Rol global que pueden tener los integrantes, según el tipo de equipo.
ROL_INTEGRANTE_POR_TIPO = {
    "GERENTE": "SUBGERENTE",
    "SUBGERENTE": "JEFE",
    "JEFE": "GTR",
    "GTR": "MIEMBRO",
}

# Roles que un equipo debe tener asignados como aprobadores (uno de cada).
ROLES_APROBADOR = ("GERENTE", "SUBGERENTE", "JEFE")

# Roles de aprobador permitidos según el tipo de equipo (el líder del equipo).
#   EQUIPO GTR        -> cualquiera (gerente, subgerente o jefe), mínimo uno.
#   EQUIPO DE JEFE    -> gerente y/o subgerente.
#   EQUIPO DE SUBGTE. -> solo gerente.
#   EQUIPO DE GERENTE -> sin aprobadores.
ROLES_APROBADOR_POR_TIPO = {
    "GERENTE": (),
    "SUBGERENTE": ("GERENTE",),
    "JEFE": ("GERENTE", "SUBGERENTE"),
    "GTR": ("GERENTE", "SUBGERENTE", "JEFE"),
}


def roles_aprobador_para(tipo_equipo):
    """Roles de aprobador permitidos para un tipo de equipo.

    Devuelve una tupla vacía si el tipo no requiere aprobadores (equipo de gerente).
    """
    return ROLES_APROBADOR_POR_TIPO.get(tipo_equipo, ROLES_APROBADOR_POR_TIPO["GTR"])


def nombre_nivel(nivel):
    """Etiqueta legible de un rol de la jerarquía."""
    return NOMBRES_ROL.get(nivel, nivel)


def nivel_efectivo(user):
    """Devuelve el rol de mayor rango del usuario dentro de la jerarquía.

    Prioriza el orden ROLES_LIDER (GERENTE > SUBGERENTE > JEFE > GTR).
    Devuelve None si no posee ningún rol elegible.
    """
    if not user or not user.is_authenticated:
        return None
    nombres = set(
        user.roles.values_list("rol__nombre", flat=True)
    )
    nombres = {n.upper() for n in nombres if n}
    for nombre in ROLES_LIDER:
        if nombre in nombres:
            return nombre
    return None


def puede_ser_lider(user):
    """True si el usuario puede ser líder de un equipo (no MIEMBRO/CLIENTE)."""
    if not user or not user.is_authenticated:
        return False
    if user.roles.filter(rol__nombre__iexact="Administrador").exists():
        return True
    return nivel_efectivo(user) is not None


def tipo_equipo_para(user):
    """Etiqueta del tipo de equipo según el rol del líder."""
    return TIPOS_EQUIPO.get(nivel_efectivo(user), "EQUIPO GTR")


def rol_integrante_requerido(tipo_equipo):
    """Rol global que deben tener los integrantes de un equipo de ese tipo."""
    return ROL_INTEGRANTE_POR_TIPO.get(tipo_equipo, "MIEMBRO")
