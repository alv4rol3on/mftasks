"""Jerarquía organizacional y cadena de aprobación de solicitudes.

Aprobación global (roles a nivel organización):
    GERENTE -> SUBGERENTE -> SUPERVISOR
Paso final:
    LIDER (líder del equipo de la solicitud)

Este módulo no importa modelos para evitar imports circulares.
"""

PASOS_GLOBALES = [
    "GERENTE",
    "SUBGERENTE",
    "SUPERVISOR",
]

PASO_FINAL = "LIDER"

CADENA_APROBACION = PASOS_GLOBALES + [PASO_FINAL]

NOMBRES_NIVEL = {
    "GERENTE": "Gerente",
    "SUBGERENTE": "Subgerente",
    "SUPERVISOR": "Supervisor",
    "LIDER": "Líder",
    "COMPLETADO": "Completado",
}

ROLES_JERARQUIA = tuple(PASOS_GLOBALES)


def siguiente_paso(paso):
    """Devuelve el siguiente nivel de la cadena o None si es el último."""
    try:
        indice = CADENA_APROBACION.index(paso)
    except ValueError:
        return None
    if indice + 1 < len(CADENA_APROBACION):
        return CADENA_APROBACION[indice + 1]
    return None


def nombre_nivel(paso):
    """Etiqueta legible de un nivel."""
    return NOMBRES_NIVEL.get(paso, paso)
