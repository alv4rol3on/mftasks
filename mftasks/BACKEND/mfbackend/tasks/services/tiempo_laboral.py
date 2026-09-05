from datetime import datetime, time, timedelta

from django.utils import timezone
from ..models import Tarea, TareaLog
from typing import Optional

# ============================================================
# CONFIGURACIÓN DEL HORARIO LABORAL
# ============================================================

# Lunes a viernes 09:00-18:00, Sábado 09:00-13:00 opcional, Domingo no laboral
HORA_INICIO_LV = time(9, 0)
HORA_FIN_LV = time(18, 0)
HORA_INICIO_SAB = time(9, 0)
HORA_FIN_SAB = time(13, 0)


# ============================================================
# FUNCIONES AUXILIARES
# ============================================================

def _jornada(fecha, incluye_sabado: bool, tzinfo):
    """
    Retorna (inicio_jornada, fin_jornada) para la fecha dada o None si no es laboral.
    """
    wd = fecha.weekday()
    if wd < 5:  # L-V
        return (
            datetime.combine(fecha, HORA_INICIO_LV, tzinfo=tzinfo),
            datetime.combine(fecha, HORA_FIN_LV, tzinfo=tzinfo),
        )
    if wd == 5:  # Sábado
        if not incluye_sabado:
            return None
        return (
            datetime.combine(fecha, HORA_INICIO_SAB, tzinfo=tzinfo),
            datetime.combine(fecha, HORA_FIN_SAB, tzinfo=tzinfo),
        )
    # Domingo
    return None


def _get_incluye_sabado(obj) -> bool:
    """Extrae incluye_sabado de Tarea o de Subtarea.tarea; fallback False."""
    if obj is None:
        return False
    # Tarea directa
    if hasattr(obj, "incluye_sabado"):
        return bool(getattr(obj, "incluye_sabado"))
    # Subtarea -> tarea padre
    tarea = getattr(obj, "tarea", None)
    if tarea is not None and hasattr(tarea, "incluye_sabado"):
        return bool(getattr(tarea, "incluye_sabado"))
    # Si es Subtarea y tiene tarea_id pero no cargada, intentar lazy
    try:
        from ..models import Subtarea
        if isinstance(obj, Subtarea):
            # intentar usar cached tarea si existe
            if hasattr(obj, "tarea_id") and obj.tarea_id:
                # si no está cargada, fallback a query ligera
                if not hasattr(obj, "_tarea_cache") or obj._tarea_cache is None:
                    try:
                        # evita import circular pesado; usa filter
                        t = Tarea.objects.filter(id=obj.tarea_id).values_list("incluye_sabado", flat=True).first()
                        if t is not None:
                            return bool(t)
                    except Exception:
                        pass
    except Exception:
        pass
    return False


# ============================================================
# CALCULAR TIEMPO LABORAL
# ============================================================

def calcular_tiempo_laboral(
    inicio: datetime,
    fin: datetime,
    incluye_sabado: bool = False,
) -> timedelta:
    """
    Calcula únicamente el tiempo laboral entre dos fechas.

    Reglas:
    - Lunes a viernes 09:00 a 18:00
    - Sábado 09:00 a 13:00 si incluye_sabado=True
    - Domingo nunca cuenta
    """

    if not inicio or not fin:
        return timedelta(0)

    if inicio >= fin:
        return timedelta(0)

    tzinfo = inicio.tzinfo

    if fin.tzinfo is None and tzinfo is not None:
        fin = timezone.make_aware(fin, timezone=tzinfo)

    if inicio.tzinfo is None and fin.tzinfo is not None:
        inicio = timezone.make_aware(inicio, timezone=fin.tzinfo)

    # Si incluye_sabado no se pasó explícitamente pero obj lo tiene, caller debe pasarlo.
    # Mantener compat: si incluye_sabado es None, tratar como False.

    total = timedelta(0)

    fecha_actual = inicio.date()
    fecha_final = fin.date()

    while fecha_actual <= fecha_final:
        jornada = _jornada(fecha_actual, bool(incluye_sabado), tzinfo)
        if jornada is not None:
            jornada_inicio, jornada_fin = jornada
            inicio_real = max(inicio, jornada_inicio)
            fin_real = min(fin, jornada_fin)
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
            if inicio_standby is None:
                inicio_standby = log.fecha
        elif log.tipo_evento == TareaLog.TipoEvento.STANDBY_FIN:
            if inicio_standby is not None:
                fin_standby = log.fecha
                if fin_standby > inicio_standby:
                    periodos.append((inicio_standby, fin_standby))
                inicio_standby = None
    if inicio_standby is not None:
        if hasta > inicio_standby:
            periodos.append((inicio_standby, hasta))
    return periodos


def obtener_periodos_standby_subtarea(
    subtarea,
    hasta: Optional[datetime] = None
):
    """Períodos de standby de una subtarea (logs con subtarea_id)."""
    hasta = hasta or timezone.now()
    logs = (
        TareaLog.objects
        .filter(
            subtarea=subtarea,
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
            if inicio_standby is None:
                inicio_standby = log.fecha
        elif log.tipo_evento == TareaLog.TipoEvento.STANDBY_FIN:
            if inicio_standby is not None:
                fin_standby = log.fecha
                if fin_standby > inicio_standby:
                    periodos.append((inicio_standby, fin_standby))
                inicio_standby = None
    if inicio_standby is not None:
        if hasta > inicio_standby:
            periodos.append((inicio_standby, hasta))
    return periodos


# ============================================================
# CALCULAR TIEMPO DE STAND_BY
# ============================================================

def calcular_tiempo_standby(
    tarea: Tarea,
    desde: datetime,
    hasta: datetime,
) -> timedelta:
    if not desde or not hasta:
        return timedelta(0)
    if desde >= hasta:
        return timedelta(0)
    total = timedelta(0)
    incluye = _get_incluye_sabado(tarea)
    periodos = obtener_periodos_standby(tarea, hasta=hasta)
    for inicio_standby, fin_standby in periodos:
        inicio_real = max(inicio_standby, desde)
        fin_real = min(fin_standby, hasta)
        if inicio_real < fin_real:
            total += calcular_tiempo_laboral(inicio_real, fin_real, incluye_sabado=incluye)
    return total


def calcular_tiempo_standby_subtarea(
    subtarea,
    desde: datetime,
    hasta: datetime,
) -> timedelta:
    if not desde or not hasta:
        return timedelta(0)
    if desde >= hasta:
        return timedelta(0)
    incluye = _get_incluye_sabado(subtarea)
    total = timedelta(0)
    periodos = obtener_periodos_standby_subtarea(subtarea, hasta=hasta)
    for inicio_standby, fin_standby in periodos:
        inicio_real = max(inicio_standby, desde)
        fin_real = min(fin_standby, hasta)
        if inicio_real < fin_real:
            total += calcular_tiempo_laboral(inicio_real, fin_real, incluye_sabado=incluye)
    return total


# ============================================================
# CALCULAR TIEMPO ÚTIL TRANSCURRIDO - TAREA
# ============================================================

def calcular_tiempo_util_tarea(
    tarea: Tarea,
    fecha_fin: Optional[datetime] = None,
) -> timedelta:
    if not tarea.fecha_inicio:
        return timedelta(0)
    fecha_fin = fecha_fin or timezone.now()
    if fecha_fin <= tarea.fecha_inicio:
        return timedelta(0)
    incluye = _get_incluye_sabado(tarea)
    tiempo_total = calcular_tiempo_laboral(tarea.fecha_inicio, fecha_fin, incluye_sabado=incluye)
    tiempo_standby = calcular_tiempo_standby(tarea, tarea.fecha_inicio, fecha_fin)
    tiempo_util = tiempo_total - tiempo_standby
    if tiempo_util < timedelta(0):
        return timedelta(0)
    return tiempo_util


# ============================================================
# TIEMPO ÚTIL SUBTAREA
# ============================================================

def calcular_tiempo_util_subtarea(
    subtarea,
    fecha_fin: Optional[datetime] = None,
) -> timedelta:
    if not subtarea.fecha_inicio:
        return timedelta(0)
    fecha_fin = fecha_fin or timezone.now()
    if fecha_fin <= subtarea.fecha_inicio:
        return timedelta(0)
    incluye = _get_incluye_sabado(subtarea)
    tiempo_total = calcular_tiempo_laboral(subtarea.fecha_inicio, fecha_fin, incluye_sabado=incluye)
    tiempo_standby = calcular_tiempo_standby_subtarea(subtarea, subtarea.fecha_inicio, fecha_fin)
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
    if not tarea.fecha_inicio:
        return timedelta(0)
    if not tarea.fecha_solucion:
        return timedelta(0)
    if tarea.fecha_solucion <= tarea.fecha_inicio:
        return timedelta(0)
    return calcular_tiempo_util_tarea(tarea, fecha_fin=tarea.fecha_solucion)


def calcular_tiempo_tomado_subtarea(
    subtarea,
) -> timedelta:
    if not subtarea.fecha_inicio:
        return timedelta(0)
    if not subtarea.fecha_fin:
        return timedelta(0)
    if subtarea.fecha_fin <= subtarea.fecha_inicio:
        return timedelta(0)
    return calcular_tiempo_util_subtarea(subtarea, fecha_fin=subtarea.fecha_fin)


# ============================================================
# CALCULAR TIEMPO PLANIFICADO
# ============================================================

def calcular_tiempo_planificado_tarea(
    tarea: Tarea,
) -> timedelta:
    if not tarea.fecha_inicio:
        return timedelta(0)
    if not tarea.fecha_entrega_aproximada:
        return timedelta(0)
    if tarea.fecha_entrega_aproximada <= tarea.fecha_inicio:
        return timedelta(0)
    incluye = _get_incluye_sabado(tarea)
    return calcular_tiempo_laboral(tarea.fecha_inicio, tarea.fecha_entrega_aproximada, incluye_sabado=incluye)


# ============================================================
# CALCULAR TIEMPO ÚTIL RESTANTE
# ============================================================

def calcular_tiempo_restante_tarea(
    tarea: Tarea,
    ahora: Optional[datetime] = None
) -> timedelta:
    if not tarea.fecha_inicio:
        return timedelta(0)
    if not tarea.fecha_entrega_aproximada:
        return timedelta(0)
    ahora = ahora or timezone.now()
    inicio = tarea.fecha_inicio
    entrega = tarea.fecha_entrega_aproximada
    if ahora <= inicio:
        return calcular_tiempo_planificado_tarea(tarea)
    if ahora >= entrega:
        return timedelta(0)
    incluye = _get_incluye_sabado(tarea)
    tiempo_planificado = calcular_tiempo_laboral(inicio, entrega, incluye_sabado=incluye)
    tiempo_transcurrido = calcular_tiempo_util_tarea(tarea, fecha_fin=ahora)
    restante = tiempo_planificado - tiempo_transcurrido
    if restante < timedelta(0):
        return timedelta(0)
    return restante


def calcular_tiempo_restante_subtarea(
    subtarea,
    ahora: Optional[datetime] = None
) -> timedelta:
    """
    Tiempo restante de subtarea usa deadline de la tarea padre (incluye_sabado de la tarea).
    Si subtarea ya está solucionada, retorna 0.
    """
    if subtarea.estado == "SOLUCIONADO":
        return timedelta(0)
    tarea = getattr(subtarea, "tarea", None)
    if tarea is None:
        return timedelta(0)
    if not tarea.fecha_inicio or not tarea.fecha_entrega_aproximada:
        return timedelta(0)
    ahora = ahora or timezone.now()
    # Si aún no ha empezado la subtarea, el restante es el de la tarea
    # Si ya empezó, el restante es planificado - util_subtarea (pero nunca mayor que restante_tarea)
    restante_tarea = calcular_tiempo_restante_tarea(tarea, ahora=ahora)
    if not subtarea.fecha_inicio:
        return restante_tarea
    # Tiempo tomado subtarea hasta ahora
    tiempo_tomado = calcular_tiempo_util_subtarea(subtarea, fecha_fin=ahora)
    incluye = _get_incluye_sabado(tarea)
    tiempo_planificado = calcular_tiempo_laboral(tarea.fecha_inicio, tarea.fecha_entrega_aproximada, incluye_sabado=incluye)
    # Restante subtarea = planificado - tomado_subtarea (cap a restante_tarea)
    restante_sub = tiempo_planificado - tiempo_tomado
    if restante_sub < timedelta(0):
        return timedelta(0)
    # No puede ser mayor que restante_tarea (si subtarea empezó tarde, le queda menos)
    if restante_sub > restante_tarea:
        return restante_tarea
    return restante_sub


# ============================================================
# ESTADO DEL CONTADOR - TAREA
# ============================================================

def obtener_contador_tarea(
    tarea: Tarea,
    ahora: Optional[datetime] = None,
):
    ahora = ahora or timezone.now()
    incluye = _get_incluye_sabado(tarea)

    # TAREA SOLUCIONADA
    if tarea.estado == Tarea.Estado.SOLUCIONADO:
        tiempo_tomado = calcular_tiempo_tomado_tarea(tarea)
        tiempo_planificado = calcular_tiempo_planificado_tarea(tarea)
        return {
            "activo": False,
            "pausado": False,
            "finalizado": True,
            "segundos_restantes": 0,
            "tiempo_tomado_segundos": int(tiempo_tomado.total_seconds()),
            "tiempo_planificado_segundos": int(tiempo_planificado.total_seconds()),
            "incluye_sabado": incluye,
            "fecha_entrega_aproximada": tarea.fecha_entrega_aproximada.isoformat() if tarea.fecha_entrega_aproximada else None,
            "fecha_solucion": tarea.fecha_solucion.isoformat() if tarea.fecha_solucion else None,
            "fecha_inicio": tarea.fecha_inicio.isoformat() if tarea.fecha_inicio else None,
            "servidor_ahora": ahora.isoformat(),
        }

    if tarea.estado == Tarea.Estado.STAND_BY:
        tiempo_restante = calcular_tiempo_restante_tarea(tarea, ahora=ahora)
        return {
            "activo": False,
            "pausado": True,
            "finalizado": False,
            "segundos_restantes": int(tiempo_restante.total_seconds()),
            "tiempo_tomado_segundos": None,
            "tiempo_planificado_segundos": int(calcular_tiempo_planificado_tarea(tarea).total_seconds()) if tarea.fecha_inicio and tarea.fecha_entrega_aproximada else 0,
            "incluye_sabado": incluye,
            "fecha_entrega_aproximada": tarea.fecha_entrega_aproximada.isoformat() if tarea.fecha_entrega_aproximada else None,
            "fecha_inicio": tarea.fecha_inicio.isoformat() if tarea.fecha_inicio else None,
            "servidor_ahora": ahora.isoformat(),
        }

    if tarea.estado == Tarea.Estado.RECHAZADO:
        return {
            "activo": False,
            "pausado": False,
            "finalizado": False,
            "segundos_restantes": 0,
            "tiempo_tomado_segundos": None,
            "incluye_sabado": incluye,
            "fecha_entrega_aproximada": tarea.fecha_entrega_aproximada.isoformat() if tarea.fecha_entrega_aproximada else None,
        }

    if not tarea.fecha_inicio or not tarea.fecha_entrega_aproximada:
        return {
            "activo": False,
            "pausado": False,
            "finalizado": False,
            "segundos_restantes": 0,
            "tiempo_tomado_segundos": None,
            "incluye_sabado": incluye,
            "fecha_entrega_aproximada": None,
        }

    tiempo_restante = calcular_tiempo_restante_tarea(tarea, ahora=ahora)
    return {
        "activo": True,
        "pausado": False,
        "finalizado": False,
        "segundos_restantes": int(tiempo_restante.total_seconds()),
        "tiempo_tomado_segundos": None,
        "tiempo_planificado_segundos": int(calcular_tiempo_planificado_tarea(tarea).total_seconds()),
        "incluye_sabado": incluye,
        "fecha_entrega_aproximada": tarea.fecha_entrega_aproximada.isoformat(),
        "fecha_inicio": tarea.fecha_inicio.isoformat() if tarea.fecha_inicio else None,
        "servidor_ahora": ahora.isoformat()
    }


# ============================================================
# ESTADO DEL CONTADOR - SUBTAREA
# ============================================================

def obtener_contador_subtarea(
    subtarea,
    ahora: Optional[datetime] = None,
):
    ahora = ahora or timezone.now()
    incluye = _get_incluye_sabado(subtarea)

    # SOLUCIONADO: muestra tiempo tomado
    if subtarea.estado == "SOLUCIONADO":
        tiempo_tomado = calcular_tiempo_tomado_subtarea(subtarea)
        return {
            "activo": False,
            "pausado": False,
            "finalizado": True,
            "segundos_restantes": 0,
            "tiempo_tomado_segundos": int(tiempo_tomado.total_seconds()),
            "incluye_sabado": incluye,
            "fecha_inicio": subtarea.fecha_inicio.isoformat() if subtarea.fecha_inicio else None,
            "fecha_fin": subtarea.fecha_fin.isoformat() if subtarea.fecha_fin else None,
            "servidor_ahora": ahora.isoformat(),
        }

    if subtarea.estado == "STAND_BY":
        # Congelado: restante igual que si estuviera pausada
        tarea = getattr(subtarea, "tarea", None)
        restante = calcular_tiempo_restante_subtarea(subtarea, ahora=ahora) if tarea else timedelta(0)
        return {
            "activo": False,
            "pausado": True,
            "finalizado": False,
            "segundos_restantes": int(restante.total_seconds()),
            "tiempo_tomado_segundos": None,
            "incluye_sabado": incluye,
            "fecha_inicio": subtarea.fecha_inicio.isoformat() if subtarea.fecha_inicio else None,
            "fecha_fin": None,
            "servidor_ahora": ahora.isoformat(),
        }

    # EN_ESPERA sin fecha_inicio -> restante es el de la tarea
    if not subtarea.fecha_inicio:
        tarea = getattr(subtarea, "tarea", None)
        restante = calcular_tiempo_restante_subtarea(subtarea, ahora=ahora) if tarea else timedelta(0)
        # EN_ESPERA no activo hasta empezar
        return {
            "activo": False,
            "pausado": False,
            "finalizado": False,
            "segundos_restantes": int(restante.total_seconds()),
            "tiempo_tomado_segundos": None,
            "incluye_sabado": incluye,
            "fecha_inicio": None,
            "fecha_fin": None,
            "servidor_ahora": ahora.isoformat(),
        }

    # EN_DESARROLLO activo
    restante = calcular_tiempo_restante_subtarea(subtarea, ahora=ahora)
    return {
        "activo": True,
        "pausado": False,
        "finalizado": False,
        "segundos_restantes": int(restante.total_seconds()),
        "tiempo_tomado_segundos": None,
        "incluye_sabado": incluye,
        "fecha_inicio": subtarea.fecha_inicio.isoformat() if subtarea.fecha_inicio else None,
        "fecha_fin": None,
        "servidor_ahora": ahora.isoformat(),
    }
