import logging
from django.utils import timezone
from django.db import transaction

logger = logging.getLogger(__name__)

def check_inicios_programados():
    """Worker APScheduler: APROBADO con fecha_inicio pasada y en jornada -> EN_DESARROLLO."""
    from .models import Tarea, TareaLog
    from .services.tiempo_laboral import esta_en_jornada
    from .services.logs import registrar_log

    ahora = timezone.localtime(timezone.now())
    candidatas = Tarea.objects.filter(
        estado=Tarea.Estado.APROBADO,
        fecha_inicio__isnull=False,
        fecha_inicio__lte=ahora,
    ).select_related("equipo")

    count = 0
    for tarea in candidatas:
        # respetar horario laboral: solo inicia si ahora está en jornada
        incluye = bool(getattr(tarea, "incluye_sabado", False))
        if not esta_en_jornada(ahora, incluye_sabado=incluye):
            continue
        # dependencias
        from .views import _tiene_dependencias_pendientes_tarea
        pendientes = _tiene_dependencias_pendientes_tarea(tarea)
        if pendientes:
            continue
        try:
            with transaction.atomic():
                # re-check dentro de transacción con lock
                t = Tarea.objects.select_for_update().get(pk=tarea.pk)
                if t.estado != Tarea.Estado.APROBADO:
                    continue
                if t.fecha_inicio is None or t.fecha_inicio > timezone.localtime(timezone.now()):
                    continue
                if not esta_en_jornada(timezone.localtime(timezone.now()), incluye_sabado=bool(t.incluye_sabado)):
                    continue
                estado_ant = t.estado
                t.estado = Tarea.Estado.EN_DESARROLLO
                t.save(update_fields=["estado"])
                registrar_log(
                    tarea=t,
                    usuario=None,
                    tipo_evento=TareaLog.TipoEvento.INICIO,
                    estado_anterior=estado_ant,
                    estado_nuevo=t.estado,
                    detalle=f"Inicio programado ejecutado automáticamente a las {ahora.isoformat()} (horario laboral).",
                )
                count += 1
        except Exception as e:
            logger.exception(f"Error auto-inicio tarea {tarea.pk}: {e}")
    if count:
        logger.info(f"APScheduler: {count} tareas iniciadas automáticamente.")


_scheduler = None

def start_scheduler():
    global _scheduler
    if _scheduler is not None:
        return
    try:
        from apscheduler.schedulers.background import BackgroundScheduler
        from apscheduler.triggers.interval import IntervalTrigger

        _scheduler = BackgroundScheduler(timezone=str(timezone.get_current_timezone()))
        _scheduler.add_job(
            check_inicios_programados,
            trigger=IntervalTrigger(seconds=60),
            id="check_inicios_programados",
            max_instances=1,
            coalesce=True,
            replace_existing=True,
        )
        _scheduler.start()
        logger.info("APScheduler iniciado (check_inicios_programados cada 60s).")
    except Exception as e:
        logger.exception(f"No se pudo iniciar APScheduler: {e}")
