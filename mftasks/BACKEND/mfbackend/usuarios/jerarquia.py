
"""Jerarquía organizacional y cadena de aprobación de solicitudes.

Aprobación global:
    GERENTE / SUBGERENTE / SUPERVISOR
    Cualquiera de estos niveles puede aprobar.

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
    """Devuelve el siguiente paso del flujo de aprobación.

    GERENTE, SUBGERENTE y SUPERVISOR son niveles alternativos:
    basta con que cualquiera de ellos apruebe para pasar directamente
    al LIDER.

    Si el LIDER aprueba, el flujo termina.
    """
    if paso in PASOS_GLOBALES:
        return PASO_FINAL

    if paso == PASO_FINAL:
        return None

    return None


def nombre_nivel(paso):
    """Etiqueta legible de un nivel."""
    return NOMBRES_NIVEL.get(paso, paso)

