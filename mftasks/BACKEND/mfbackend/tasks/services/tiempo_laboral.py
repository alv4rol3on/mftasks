from datetime import datetime, time, timedelta

from django.utils import timezone
from ..models import Tarea, TareaLog
from typing import Optional

# ============================================================
# CONFIGURACIÓN DEL HORARIO LABORAL
# ============================================================

HORA_INICIO = time(9, 0)
HORA_FIN = time(18, 0)


# ============================================================
# FUNCIONES AUXILIARES
# ============================================================

def _inicio_jornada(fecha, tzinfo):
    return datetime.combine(
        fecha,
        HORA_INICIO,
        tzinfo=tzinfo,
    )


def _fin_jornada(fecha, tzinfo):
    return datetime.combine(
        fecha,
        HORA_FIN,
        tzinfo=tzinfo,
    )


# ============================================================
# CALCULAR TIEMPO LABORAL
# ============================================================

def calcular_tiempo_laboral(
    inicio: datetime,
    fin: datetime,
) -> timedelta:
    """
    Calcula únicamente el tiempo laboral entre dos fechas.

    Reglas:
    - Lunes a viernes
    - 09:00 a 18:00
    - No cuenta noches
    - No cuenta sábados
    - No cuenta domingos
    """

    if not inicio or not fin:
        return timedelta(0)

    if inicio >= fin:
        return timedelta(0)

    # Aseguramos que ambos datetime tengan la misma zona horaria.
    tzinfo = inicio.tzinfo

    if fin.tzinfo is None and tzinfo is not None:
        fin = timezone.make_aware(fin, timezone=tzinfo)

    if inicio.tzinfo is None and fin.tzinfo is not None:
        inicio = timezone.make_aware(inicio, timezone=fin.tzinfo)

    total = timedelta(0)

    fecha_actual = inicio.date()
    fecha_final = fin.date()

    while fecha_actual <= fecha_final:

        # weekday():
        # 0 = lunes
        # 1 = martes
        # ...
        # 4 = viernes
        # 5 = sábado
        # 6 = domingo
        if fecha_actual.weekday() < 5:

            jornada_inicio = _inicio_jornada(
                fecha_actual,
                tzinfo,
            )

            jornada_fin = _fin_jornada(
                fecha_actual,
                tzinfo,
            )

            inicio_real = max(
                inicio,
                jornada_inicio,
            )

            fin_real = min(
                fin,
                jornada_fin,
            )

            if inicio_real < fin_real:
                total += fin_real - inicio_real

        fecha_actual += timedelta(days=1)

    return total


# ============================================================
# OBTENER PERÍODOS DE STAND_BY DE UNA TAREA
# ============================================================

def obtener_periodos_standby(
    tarea: Tarea,
    hasta: Optional[datetime] = None
):
    """
    Obtiene los períodos de STAND_BY de una tarea.

    Retorna una lista de tuplas:

        [
            (inicio_standby, fin_standby),
            ...
        ]

    Si existe un STANDBY_INICIO sin STANDBY_FIN,
    se considera abierto.

    En ese caso, 'hasta' será utilizado como fin temporal.

    Esto es importante para que el contador pueda congelarse
    mientras la tarea está actualmente en STAND_BY.
    """

    hasta = hasta or timezone.now()

    logs = (
        TareaLog.objects
        .filter(
            tarea=tarea,
            subtarea__isnull=True,
            tipo_evento__in=[
                TareaLog.TipoEvento.STANDBY_INICIO,
                TareaLog.TipoEvento.STANDBY_FIN,
            ],
        )
        .order_by("fecha", "id")
    )

    periodos = []

    inicio_standby = None

    for log in logs:

        if log.tipo_evento == TareaLog.TipoEvento.STANDBY_INICIO:

            # Evitamos abrir otro período si ya existe uno.
            if inicio_standby is None:
                inicio_standby = log.fecha

        elif log.tipo_evento == TareaLog.TipoEvento.STANDBY_FIN:

            if inicio_standby is not None:

                fin_standby = log.fecha

                if fin_standby > inicio_standby:
                    periodos.append(
                        (
                            inicio_standby,
                            fin_standby,
                        )
                    )

                inicio_standby = None

    # ========================================================
    # STANDBY ACTUALMENTE ABIERTO
    # ========================================================

    if inicio_standby is not None:

        if hasta > inicio_standby:
            periodos.append(
                (
                    inicio_standby,
                    hasta,
                )
            )

    return periodos


# ============================================================
# CALCULAR TIEMPO DE STAND_BY
# ============================================================

def calcular_tiempo_standby(
    tarea: Tarea,
    desde: datetime,
    hasta: datetime,
) -> timedelta:
    """
    Calcula cuánto tiempo laboral estuvo la tarea en STAND_BY
    dentro del rango indicado.
    """

    if not desde or not hasta:
        return timedelta(0)

    if desde >= hasta:
        return timedelta(0)

    total = timedelta(0)

    periodos = obtener_periodos_standby(
        tarea,
        hasta=hasta,
    )

    for inicio_standby, fin_standby in periodos:

        # Limitamos el período de standby al rango
        # que estamos analizando.

        inicio_real = max(
            inicio_standby,
            desde,
        )

        fin_real = min(
            fin_standby,
            hasta,
        )

        if inicio_real < fin_real:

            total += calcular_tiempo_laboral(
                inicio_real,
                fin_real,
            )

    return total


# ============================================================
# CALCULAR TIEMPO ÚTIL TRANSCURRIDO
# ============================================================

def calcular_tiempo_util_tarea(
    tarea: Tarea,
    fecha_fin: Optional[datetime] = None,
) -> timedelta:
    """
    Calcula el tiempo útil que ha transcurrido desde el inicio
    de la tarea hasta fecha_fin.

    Se descuenta:
    - Horario fuera de jornada
    - Sábados
    - Domingos
    - Períodos de STAND_BY

    Si la tarea está actualmente en STAND_BY y no existe
    STANDBY_FIN todavía, el tiempo se congela en el momento
    en que comenzó ese STAND_BY.
    """

    if not tarea.fecha_inicio:
        return timedelta(0)

    fecha_fin = fecha_fin or timezone.now()

    if fecha_fin <= tarea.fecha_inicio:
        return timedelta(0)

    # Tiempo laboral bruto.
    tiempo_total = calcular_tiempo_laboral(
        tarea.fecha_inicio,
        fecha_fin,
    )

    # Tiempo laboral en standby.
    tiempo_standby = calcular_tiempo_standby(
        tarea,
        tarea.fecha_inicio,
        fecha_fin,
    )

    tiempo_util = tiempo_total - tiempo_standby

    if tiempo_util < timedelta(0):
        return timedelta(0)

    return tiempo_util


# ============================================================
# CALCULAR TIEMPO TOMADO POR UNA TAREA SOLUCIONADA
# ============================================================

def calcular_tiempo_tomado_tarea(
    tarea: Tarea,
) -> timedelta:
    """
    Calcula cuánto tiempo útil tomó solucionar una tarea.

    Utiliza:

        fecha_inicio
        fecha_solucion

    y descuenta todos los períodos de STAND_BY.
    """

    if not tarea.fecha_inicio:
        return timedelta(0)

    if not tarea.fecha_solucion:
        return timedelta(0)

    if tarea.fecha_solucion <= tarea.fecha_inicio:
        return timedelta(0)

    return calcular_tiempo_util_tarea(
        tarea,
        fecha_fin=tarea.fecha_solucion,
    )


# ============================================================
# CALCULAR TIEMPO PLANIFICADO
# ============================================================

def calcular_tiempo_planificado_tarea(
    tarea: Tarea,
) -> timedelta:
    """
    Calcula el tiempo laboral planificado entre:

        fecha_inicio
        fecha_entrega_aproximada

    No descuenta standby porque este valor representa
    el tiempo laboral disponible originalmente.
    """

    if not tarea.fecha_inicio:
        return timedelta(0)

    if not tarea.fecha_entrega_aproximada:
        return timedelta(0)

    if tarea.fecha_entrega_aproximada <= tarea.fecha_inicio:
        return timedelta(0)

    return calcular_tiempo_laboral(
        tarea.fecha_inicio,
        tarea.fecha_entrega_aproximada,
    )


# ============================================================
# CALCULAR TIEMPO ÚTIL RESTANTE
# ============================================================

def calcular_tiempo_restante_tarea(
    tarea: Tarea,
    ahora: Optional[datetime] = None
) -> timedelta:
    """
    Calcula cuánto tiempo laboral útil queda para la tarea.

    Reglas:
    - Lunes a viernes
    - 09:00 a 18:00
    - No cuenta períodos de STAND_BY
    - Si está actualmente en STAND_BY,
      el contador queda congelado.
    - Si ya superó la fecha de entrega, devuelve 0.
    """

    if not tarea.fecha_inicio:
        return timedelta(0)

    if not tarea.fecha_entrega_aproximada:
        return timedelta(0)

    ahora = ahora or timezone.now()

    inicio = tarea.fecha_inicio
    entrega = tarea.fecha_entrega_aproximada

    # ========================================================
    # CASO 1: TODAVÍA NO LLEGA LA FECHA DE INICIO
    # ========================================================

    if ahora <= inicio:
        return calcular_tiempo_planificado_tarea(tarea)

    # ========================================================
    # CASO 2: YA SUPERÓ LA FECHA DE ENTREGA
    # ========================================================

    if ahora >= entrega:

        # Si ya pasó la entrega, no mostramos tiempo negativo.
        return timedelta(0)

    # ========================================================
    # TIEMPO LABORAL TOTAL PLANIFICADO
    # ========================================================

    tiempo_planificado = calcular_tiempo_laboral(
        inicio,
        entrega,
    )

    # ========================================================
    # TIEMPO ÚTIL YA TRANSCURRIDO
    # ========================================================

    tiempo_transcurrido = calcular_tiempo_util_tarea(
        tarea,
        fecha_fin=ahora,
    )

    # ========================================================
    # TIEMPO RESTANTE
    # ========================================================

    restante = tiempo_planificado - tiempo_transcurrido

    if restante < timedelta(0):
        return timedelta(0)

    return restante


# ============================================================
# ESTADO DEL CONTADOR
# ============================================================

def obtener_contador_tarea(
    tarea: Tarea,
    ahora: Optional[datetime] = None,
):
    """
    Devuelve toda la información necesaria para que
    el frontend muestre el contador.

    Estados:

    EN_DESARROLLO:
        contador activo

    STAND_BY:
        contador congelado

    SOLUCIONADO:
        muestra tiempo tomado

    RECHAZADO:
        contador desactivado
    """

    ahora = ahora or timezone.now()

    # ========================================================
    # TAREA SOLUCIONADA
    # ========================================================

    if tarea.estado == Tarea.Estado.SOLUCIONADO:

        tiempo_tomado = calcular_tiempo_tomado_tarea(
            tarea,
        )

        return {
            "activo": False,
            "pausado": False,
            "finalizado": True,
            "segundos_restantes": 0,
            "tiempo_tomado_segundos": int(
                tiempo_tomado.total_seconds()
            ),
            "fecha_entrega_aproximada": (
                tarea.fecha_entrega_aproximada.isoformat()
                if tarea.fecha_entrega_aproximada
                else None
            ),
        }

    # ========================================================
    # TAREA EN STAND_BY
    # ========================================================

    if tarea.estado == Tarea.Estado.STAND_BY:

        tiempo_restante = calcular_tiempo_restante_tarea(
            tarea,
            ahora=ahora,
        )

        return {
            "activo": False,
            "pausado": True,
            "finalizado": False,
            "segundos_restantes": int(
                tiempo_restante.total_seconds()
            ),
            "tiempo_tomado_segundos": None,
            "fecha_entrega_aproximada": (
                tarea.fecha_entrega_aproximada.isoformat()
                if tarea.fecha_entrega_aproximada
                else None
            ),
        }

    # ========================================================
    # TAREA RECHAZADA
    # ========================================================

    if tarea.estado == Tarea.Estado.RECHAZADO:

        return {
            "activo": False,
            "pausado": False,
            "finalizado": False,
            "segundos_restantes": 0,
            "tiempo_tomado_segundos": None,
            "fecha_entrega_aproximada": (
                tarea.fecha_entrega_aproximada.isoformat()
                if tarea.fecha_entrega_aproximada
                else None
            ),
        }

    # ========================================================
    # TAREA SIN FECHA DE INICIO O ENTREGA
    # ========================================================

    if (
        not tarea.fecha_inicio
        or not tarea.fecha_entrega_aproximada
    ):
        return {
            "activo": False,
            "pausado": False,
            "finalizado": False,
            "segundos_restantes": 0,
            "tiempo_tomado_segundos": None,
            "fecha_entrega_aproximada": None,
        }

    # ========================================================
    # TAREA ACTIVA
    # ========================================================

    tiempo_restante = calcular_tiempo_restante_tarea(
        tarea,
        ahora=ahora,
    )

    return {
        "activo": True,
        "pausado": False,
        "finalizado": False,
        "segundos_restantes": int(
            tiempo_restante.total_seconds()
        ),
        "tiempo_tomado_segundos": None,
        "fecha_entrega_aproximada": (
            tarea.fecha_entrega_aproximada.isoformat()
        ),
        "servidor_ahora": ahora.isoformat()
    }