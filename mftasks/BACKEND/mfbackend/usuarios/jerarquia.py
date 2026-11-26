"""Jerarquía organizacional dinámica basada en relaciones de aprobación.

El orden jerárquico NO se almacena ni se codifica: se deriva recorriendo la
relación `Nivel.superior`. Cada nivel (salvo la raíz) tiene exactamente un
superior directo; la cadena completa de aprobadores se calcula en código y
nunca se persiste.

Este módulo importa los modelos de forma diferida (dentro de las funciones)
para evitar imports circulares.
"""

# Etiquetas de las fases del flujo de aprobación de una tarea.
NOMBRES_ROL = {
    "APROBADORES": "Aprobadores",
    "LIDER": "Revisión del líder",
    "COMPLETADO": "Completado",
}


def get_nivel(valor):
    """Resuelve un Nivel a partir de un id, nombre, Nivel o None."""
    from .models import Nivel

    if valor is None:
        return None
    if isinstance(valor, Nivel):
        return valor
    if isinstance(valor, int):
        return Nivel.objects.filter(pk=valor).first()
    return Nivel.objects.filter(nombre__iexact=str(valor).strip()).first()


def cadena_aprobacion(nivel):
    """Cadena de superiores de un nivel (directo -> ... -> raíz).

    No incluye al propio nivel. Se calcula en memoria; no se almacena.
    """
    nivel = get_nivel(nivel)
    if nivel is None:
        return []

    cadena = []
    visitados = {nivel.pk}
    actual = nivel.superior
    while actual is not None:
        if actual.pk in visitados:
            # Protección ante datos corruptos (no debería ocurrir por clean()).
            break
        cadena.append(actual)
        visitados.add(actual.pk)
        actual = actual.superior
    return cadena


def niveles_subordinados(nivel):
    """Niveles que dependen transitivamente de `nivel` por `superior`.

    Es el conjunto de niveles cuya `cadena_aprobacion` contiene a `nivel`, es
    decir, los equipos a los que `nivel` puede aprobar. No incluye al propio
    nivel. Se calcula en memoria y protege ante ciclos.
    """
    from .models import Nivel

    nivel = get_nivel(nivel)
    if nivel is None:
        return []

    resultado = []
    visitados = {nivel.pk}
    pendientes = list(Nivel.objects.filter(superior=nivel))

    while pendientes:
        actual = pendientes.pop()
        if actual.pk in visitados:
            continue
        visitados.add(actual.pk)
        resultado.append(actual)
        pendientes.extend(Nivel.objects.filter(superior=actual))

    return resultado


def profundidad(nivel):
    """Número de superiores de un nivel (0 = raíz). Posición derivada."""
    return len(cadena_aprobacion(nivel))


def nivel_efectivo(user):
    """Nivel de mayor rango del usuario (el de menor profundidad).

    Devuelve un objeto Nivel o None si el usuario no posee niveles activos.
    """
    if not user or not user.is_authenticated:
        return None

    niveles = [
        un.nivel
        for un in user.niveles.select_related("nivel").all()
        if un.nivel and un.nivel.activo
    ]
    if not niveles:
        return None

    # Menor profundidad = mayor rango. Desempate determinista por nombre.
    return sorted(niveles, key=lambda n: (profundidad(n), n.nombre.upper()))[0]


def nombre_nivel_efectivo(user):
    """Nombre del nivel de mayor rango del usuario."""
    nivel = nivel_efectivo(user)
    return nivel.nombre if nivel else None


def puede_ser_lider(user):
    """True si el usuario puede liderar un equipo.

    Solo un COLABORADOR cuyo nivel efectivo tenga `puede_liderar=True` puede
    liderar; nunca por nombres codificados. Un administrador gestiona equipos
    pero no es elegible como líder.
    """
    from .models import TipoUsuario

    if not user or not user.is_authenticated:
        return False
    if getattr(user, "tipo_usuario", None) != TipoUsuario.COLABORADOR:
        return False
    nivel = nivel_efectivo(user)
    return bool(nivel and nivel.puede_liderar)


def _nivel_de_equipo(equipo):
    from .models import Equipo

    if equipo is None:
        return None
    if not isinstance(equipo, Equipo):
        return get_nivel(equipo)
    return getattr(equipo, "nivel", None)


def niveles_aprobador_de_equipo(equipo):
    """Niveles de la cadena de aprobación de un equipo (lista de Nivel)."""
    return cadena_aprobacion(_nivel_de_equipo(equipo))


def niveles_aprobador_para(valor):
    """Nombres de los niveles aprobadores.

    Acepta un nombre de nivel, un objeto Nivel o un objeto Equipo.
    """
    from .models import Equipo

    if isinstance(valor, Equipo):
        return [n.nombre for n in niveles_aprobador_de_equipo(valor)]
    return [n.nombre for n in cadena_aprobacion(get_nivel(valor))]


def niveles_integrantes_requeridos(equipo):
    """Niveles admitidos como integrantes según la configuración global.

    - DIRECTO: hijos directos activos del nivel del líder.
    - CUALQUIER: todos los niveles activos que estén debajo del nivel del
      líder en la jerarquía.
    """
    from .models import Nivel

    nivel = _nivel_de_equipo(equipo)
    if nivel is None:
        return []

    from tasks.models import ConfiguracionAprobacion

    config = ConfiguracionAprobacion.obtener()
    if config.alcance_integrantes == ConfiguracionAprobacion.AlcanceIntegrantes.CUALQUIER:
        return [n for n in niveles_subordinados(nivel) if n.activo]

    return list(Nivel.objects.filter(superior=nivel, activo=True))


def renumerar_niveles():
    """Recalcula las etiquetas `NIVEL {n}` de todos los niveles no sistema.

    El número mayor corresponde a la mayor jerarquía. Se ordena por
    profundidad ascendente (raíz primero) y se asignan números de N a 1.
    La actualización se hace en dos pasadas para respetar el nombre único.
    """
    from django.db import transaction

    from .models import Nivel

    with transaction.atomic():
        niveles = list(Nivel.objects.filter(es_sistema=False))
        if not niveles:
            return

        mapa = {n.pk: n for n in niveles}

        def _profundidad(nivel):
            distancia = 0
            vistos = set()
            actual = nivel
            while actual.superior_id and actual.superior_id in mapa:
                if actual.superior_id in vistos:
                    break
                vistos.add(actual.superior_id)
                actual = mapa[actual.superior_id]
                distancia += 1
            return distancia

        ordenados = sorted(
            niveles,
            key=lambda n: (_profundidad(n), n.pk),
        )
        total = len(ordenados)

        for nivel in ordenados:
            nivel.nombre = f"__nivel_tmp_{nivel.pk}"
        Nivel.objects.bulk_update(ordenados, ["nombre"])

        for indice, nivel in enumerate(ordenados):
            nivel.nombre = f"NIVEL {total - indice}"
        Nivel.objects.bulk_update(ordenados, ["nombre"])


def nombre_nivel(nivel):
    """Etiqueta legible de una fase de aprobación."""
    return NOMBRES_ROL.get(nivel, nivel)
