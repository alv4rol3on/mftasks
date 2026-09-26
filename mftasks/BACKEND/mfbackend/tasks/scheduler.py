import logging
from django.utils import timezone
from django.db import transaction

logger = logging.getLogger(__name__)

def check_inicios_programados():
    """Worker APScheduler: APROBADO con fecha_inicio pasada y en jornada -> EN_DESARROLLO."""
    from .models import Tarea, TareaLog
    from .services.tiempo_laboral import esta_en_jornada
    from .services.logs import registrar_log
    from .services.notificaciones import notificar_tarea

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
                notificar_tarea(t)
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


def enviar_alertas_diarias():
    """
    Envía a cada equipo:
    1. Solicitudes pendientes de revisión.
    2. Resumen de solicitudes sin solucionar.
    """

    from .models import Tarea
    from usuarios.models import Equipo
    from .services.notificaciones_email import programar_correo_equipo

    estados_abiertos = [
        Tarea.Estado.APROBADO,
        Tarea.Estado.EN_DESARROLLO,
        Tarea.Estado.STAND_BY,
    ]

    equipos = Equipo.objects.filter(activo=True)

    enviados_revision = 0
    enviados_alerta = 0

    for equipo in equipos:

        # ============================================================
        # 1. SOLICITUDES PENDIENTES DE REVISIÓN
        # ============================================================

        tareas_revision = Tarea.objects.filter(
            equipo=equipo,
            activo=True,
            estado=Tarea.Estado.EN_ESPERA,
        ).order_by("fecha_creacion")

        if tareas_revision.exists():

            detalle_revision = [
                {
                    "codigo": t.ticket or str(t.id),
                    "titulo": t.asunto,
                    "estado": t.get_estado_display(),
                }
                for t in tareas_revision
            ]

            programado = programar_correo_equipo(
                evento="EQUIPO_PENDIENTE_REVISION",
                tarea=tareas_revision.first(),
                mensaje=(
                    f"Tienes {len(detalle_revision)} "
                    "solicitud(es) pendiente(s) de revisión "
                    "en tu equipo."
                ),
                contexto_adicional={
                    "tareas": detalle_revision,
                    "equipo_nombre": equipo.nombre,
                },
            )

            if programado:
                enviados_revision += 1

        # ============================================================
        # 2. SOLICITUDES SIN SOLUCIONAR
        # ============================================================

        tareas = Tarea.objects.filter(
            equipo=equipo,
            #activo=True,
            estado__in=estados_abiertos,
        ).order_by("estado", "fecha_creacion")

        if not tareas.exists():
            continue

        detalle = [
            {
                "codigo": t.ticket or str(t.id),
                "titulo": t.asunto,
                "estado": t.get_estado_display(),
            }
            for t in tareas
        ]

        programado = programar_correo_equipo(
            evento="EQUIPO_ALERTA_DIARIA",
            tarea=tareas.first(),
            mensaje=(
                f"Tienes {len(detalle)} solicitud(es) sin solucionar "
                "en tu equipo."
            ),
            contexto_adicional={
                "tareas": detalle,
                "equipo_nombre": equipo.nombre,
            },
        )

        if programado:
            enviados_alerta += 1

    if enviados_revision:
        logger.info(
            "APScheduler: recordatorios de revisión enviados a %s equipo(s).",
            enviados_revision,
        )

    if enviados_alerta:
        logger.info(
            "APScheduler: alertas diarias enviadas a %s equipo(s).",
            enviados_alerta,
        )


def start_scheduler():
    global _scheduler
    if _scheduler is not None:
        return
    try:
        from apscheduler.schedulers.background import BackgroundScheduler
        from apscheduler.triggers.cron import CronTrigger
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
        _scheduler.add_job(
            enviar_alertas_diarias,
            trigger=CronTrigger(hour=11, minute=30),
            id="envio_alertas_diarias",
            max_instances=1,
            coalesce=True,
            replace_existing=True,
        )
        _scheduler.start()
        logger.info(
            "APScheduler iniciado (auto-inicio cada 60s)."
        )
    except Exception as e:
        logger.exception(f"No se pudo iniciar APScheduler: {e}")
