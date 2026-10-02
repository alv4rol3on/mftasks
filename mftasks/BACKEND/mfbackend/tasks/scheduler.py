import logging
from django.utils import timezone
from django.db import transaction

logger = logging.getLogger(__name__)

ESTADOS_RESUMEN_CLIENTE = [
    ("EN_ESPERA", "En espera"),
    ("APROBADO", "Aprobado"),
    ("EN_DESARROLLO", "En desarrollo"),
    ("STAND_BY", "En pausa"),
    ("SOLUCIONADO", "Solucionado"),
    ("RECHAZADO", "Rechazado"),
]

ESTADOS_ABIERTOS = ["APROBADO", "EN_DESARROLLO", "STAND_BY"]


def _detalle_tareas(tareas):
    return [
        {
            "codigo": t.ticket or str(t.id),
            "titulo": t.asunto,
            "estado": t.get_estado_display(),
        }
        for t in tareas
    ]


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


def enviar_digest_miembros():
    """09:00 -> a miembros activos (no líderes): solicitudes sin solucionar."""
    from .models import Tarea
    from usuarios.models import Equipo, EquipoMiembro
    from .services.notificaciones_email import (
        obtener_correo_usuario,
        programar_correo_tarea,
        usuario_quiere_recibir,
    )

    enviados = 0

    for equipo in Equipo.objects.filter(activo=True):
        tareas = Tarea.objects.filter(
            equipo=equipo,
            estado__in=ESTADOS_ABIERTOS,
        ).order_by("estado", "fecha_creacion")

        if not tareas.exists():
            continue

        miembros = equipo.miembros.select_related("usuario").filter(
            estado=EquipoMiembro.EstadoMiembro.ACTIVO,
            rol_en_equipo=EquipoMiembro.RolEnEquipo.MIEMBRO,
        )

        correos = []
        for miembro in miembros:
            usuario = miembro.usuario
            if usuario is None or usuario.id == equipo.lider_id:
                continue
            if not usuario_quiere_recibir(usuario, "EQUIPO_ALERTA_DIARIA"):
                continue
            correo = obtener_correo_usuario(usuario)
            if correo:
                correos.append(correo)

        correos = list(dict.fromkeys(correos))
        if not correos:
            continue

        detalle = _detalle_tareas(tareas)
        programado = programar_correo_tarea(
            evento="EQUIPO_ALERTA_DIARIA",
            tarea=tareas.first(),
            destinatarios=correos,
            mensaje=(
                f"Tienes {len(detalle)} solicitud(es) sin solucionar "
                f"en el equipo {equipo.nombre}."
            ),
            contexto_adicional={
                "tareas": detalle,
                "equipo_nombre": equipo.nombre,
                "nombre_destinatario": f"equipo {equipo.nombre}",
            },
        )
        if programado:
            enviados += 1

    if enviados:
        logger.info(
            "APScheduler: alertas diarias enviadas a %s equipo(s).",
            enviados,
        )


def enviar_resumen_clientes():
    """09:00 -> a cada cliente: conteo de sus solicitudes por estado."""
    from .models import Tarea
    from usuarios.models import User
    from .services.notificaciones_email import programar_correo_tarea

    ahora = timezone.localtime(timezone.now())
    from django.db.models import Q
    usuarios = User.objects.filter(
        Q(tipo_usuario="CLIENTE") | Q(roles__rol__nombre__iexact="CLIENTE"),
        is_active=True,
    ).distinct()

    enviados = 0

    for usuario in usuarios:
        qs = Tarea.objects.filter(solicitante=usuario)
        total = qs.count()
        if total == 0:
            continue

        resumen = [
            {"estado": etiqueta, "total": qs.filter(estado=valor).count()}
            for valor, etiqueta in ESTADOS_RESUMEN_CLIENTE
        ]
        primera = qs.order_by("fecha_creacion").first()

        programado = programar_correo_tarea(
            evento="CLIENTE_RESUMEN_DIARIO",
            tarea=primera,
            usuario_destinatario=usuario,
            mensaje=(
                f"Resumen de tus {total} solicitud(es) al "
                f"{ahora.strftime('%d/%m/%Y')}."
            ),
            contexto_adicional={"resumen": resumen, "total": total},
        )
        if programado:
            enviados += 1

    if enviados:
        logger.info(
            "APScheduler: resúmenes diarios enviados a %s cliente(s).",
            enviados,
        )


_scheduler = None


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
        # 09:00 Miembros de equipo
        _scheduler.add_job(
            enviar_digest_miembros,
            trigger=CronTrigger(hour=9, minute=0),
            id="digest_miembros_0900",
            max_instances=1,
            coalesce=True,
            replace_existing=True,
        )
        # 09:00 Clientes (resumen de estados)
        _scheduler.add_job(
            enviar_resumen_clientes,
            trigger=CronTrigger(hour=9, minute=0),
            id="resumen_clientes_0900",
            max_instances=1,
            coalesce=True,
            replace_existing=True,
        )
        _scheduler.start()
        logger.info(
            "APScheduler iniciado (auto-inicio cada 60s; digests 09:00)."
        )
    except Exception as e:
        logger.exception(f"No se pudo iniciar APScheduler: {e}")
