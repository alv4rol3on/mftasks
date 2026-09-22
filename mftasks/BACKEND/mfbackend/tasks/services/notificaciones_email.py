import logging
from functools import partial

from django.db import transaction

from tasks.tasks import enviar_notificacion_email


logger = logging.getLogger(__name__)


# Mapea cada evento de correo con el campo de preferencia que lo habilita.
EVENTO_A_PREFERENCIA = {
    "SOLICITUD_CREADA": "cliente_solicitud_creada",
    "SOLICITUD_APROBADA": "cliente_solicitud_resuelta",
    "SOLICITUD_RECHAZADA": "cliente_solicitud_resuelta",
    "SOLICITUD_STANDBY": "cliente_solicitud_standby",
    "SOLICITUD_FINALIZADA": "cliente_solicitud_solucionada",
    "EQUIPO_NUEVA_SOLICITUD": "equipo_nueva_solicitud",
    "EQUIPO_PENDIENTE_REVISION": "equipo_pendiente_revision",
    "EQUIPO_ALERTA_DIARIA": "equipo_alerta_diaria",
}


def usuario_quiere_recibir(usuario, evento):
    """Indica si el usuario tiene habilitado el correo para el evento dado."""

    if usuario is None:
        return False

    campo = EVENTO_A_PREFERENCIA.get(evento)

    if not campo:
        return True

    from usuarios.models import PreferenciaNotificacion

    preferencias, _ = PreferenciaNotificacion.objects.get_or_create(
        usuario=usuario
    )

    if not preferencias.recibir_correos:
        return False

    return bool(getattr(preferencias, campo, True))


def obtener_correo_usuario(usuario):
    """
    Obtiene el correo disponible de un usuario.

    Soporta modelos que utilicen el campo `email`
    o el campo `correo`.
    """

    if usuario is None:
        return ""

    correo = (
        getattr(usuario, "email", None)
        or getattr(usuario, "correo", None)
        or ""
    )

    return str(correo).strip()


def obtener_nombre_usuario(usuario):
    """
    Construye el nombre visible del usuario.
    """

    if usuario is None:
        return "Cliente"

    nombres = str(
        getattr(usuario, "nombres", "") or ""
    ).strip()

    apellidos = str(
        getattr(usuario, "apellidos", "") or ""
    ).strip()

    nombre_completo = " ".join(
        parte
        for parte in [nombres, apellidos]
        if parte
    ).strip()

    if nombre_completo:
        return nombre_completo

    get_full_name = getattr(usuario, "get_full_name", None)

    if callable(get_full_name):
        nombre_completo = str(
            get_full_name() or ""
        ).strip()

        if nombre_completo:
            return nombre_completo

    username = str(
        getattr(usuario, "username", "") or ""
    ).strip()

    return username or "Cliente"


def obtener_codigo_tarea(tarea):
    """
    Devuelve el código visible de la solicitud.
    """

    ticket = getattr(tarea, "ticket", None)

    if ticket:
        return str(ticket)

    return str(tarea.pk)


def obtener_titulo_tarea(tarea):
    """
    Devuelve el asunto o título visible de la solicitud.
    """

    asunto = getattr(tarea, "asunto", None)

    if asunto:
        return str(asunto)

    titulo = getattr(tarea, "titulo", None)

    if titulo:
        return str(titulo)

    return "Solicitud"


def obtener_estado_tarea(tarea):
    """
    Devuelve la etiqueta legible del estado, si el modelo
    define get_estado_display().
    """

    get_estado_display = getattr(
        tarea,
        "get_estado_display",
        None,
    )

    if callable(get_estado_display):
        estado_visible = get_estado_display()

        if estado_visible:
            return str(estado_visible)

    estado = getattr(tarea, "estado", "")

    return str(estado or "")


def formatear_fecha(valor):
    """Formatea una fecha/hora en la zona horaria actual (America/Lima)."""

    if not valor:
        return ""

    from django.utils import timezone

    try:
        fecha = timezone.localtime(valor)
    except Exception:
        fecha = valor

    try:
        return fecha.strftime("%d/%m/%Y %H:%M")
    except Exception:
        return str(fecha)


def contexto_detalles_tarea(tarea):
    """Contexto común con los detalles de la solicitud para las plantillas."""

    campana = ""
    subcampana = ""

    sub = getattr(tarea, "subcampana", None)

    if sub is not None:
        subcampana = getattr(sub, "nombre", "") or ""

        if getattr(sub, "campana", None) is not None:
            campana = getattr(sub.campana, "nombre", "") or ""

    equipo = getattr(tarea, "equipo", None)

    adjuntos = []

    try:
        adjuntos = [
            archivo.nombre
            for archivo in tarea.archivos.all()
            if getattr(archivo, "nombre", None)
        ]
    except Exception:
        adjuntos = []

    return {
        "codigo": obtener_codigo_tarea(tarea),
        "titulo": obtener_titulo_tarea(tarea),
        "estado": obtener_estado_tarea(tarea),
        "descripcion": getattr(tarea, "descripcion", "") or "",
        "campana": campana,
        "subcampana": subcampana,
        "equipo_nombre": getattr(equipo, "nombre", "") or "",
        "solicitante_nombre": obtener_nombre_usuario(
            getattr(tarea, "solicitante", None)
        ),
        "fecha_creacion": formatear_fecha(
            getattr(tarea, "fecha_creacion", None)
        ),
        "fecha_entrega_aproximada": formatear_fecha(
            getattr(tarea, "fecha_entrega_aproximada", None)
        ),
        "adjuntos": adjuntos,
    }


def destinatarios_equipo(equipo, evento):
    """
    Correos de los integrantes del equipo (líder + miembros ACTIVO)
    que tengan habilitado el correo para el evento.
    """

    if equipo is None:
        return []

    from usuarios.models import EquipoMiembro

    usuarios = []

    if getattr(equipo, "lider", None) is not None:
        usuarios.append(equipo.lider)

    miembros = equipo.miembros.select_related("usuario").filter(
        estado=EquipoMiembro.EstadoMiembro.ACTIVO
    )

    for miembro in miembros:
        usuarios.append(miembro.usuario)

    vistos = set()
    correos = []

    for usuario in usuarios:
        if usuario is None or usuario.id in vistos:
            continue

        vistos.add(usuario.id)

        if not usuario_quiere_recibir(usuario, evento):
            continue

        correo = obtener_correo_usuario(usuario)

        if correo:
            correos.append(correo)

    return list(dict.fromkeys(correos))


def programar_correo_tarea(
    *,
    evento,
    tarea,
    mensaje,
    usuario_destinatario=None,
    destinatarios=None,
    contexto_adicional=None,
):
    """
    Programa una notificación por correo asociada a una tarea.

    La tarea Celery se envía únicamente después de confirmar
    correctamente la transacción de base de datos.

    Se puede indicar:
    - usuario_destinatario: usuario del cual obtener nombre y correo.
    - destinatarios: lista explícita de correos.
    - contexto_adicional: información adicional para la plantilla.

    Devuelve True si la notificación quedó programada.
    Devuelve False si no encontró destinatarios válidos.
    """

    if tarea is None:
        raise ValueError(
            "La tarea es obligatoria para programar el correo."
        )

    if usuario_destinatario is None:
        usuario_destinatario = getattr(
            tarea,
            "solicitante",
            None,
        )

    correos = []

    if destinatarios:
        correos.extend(destinatarios)

    if usuario_destinatario is not None and usuario_quiere_recibir(
        usuario_destinatario, evento
    ):
        correo_usuario = obtener_correo_usuario(
            usuario_destinatario
        )

        if correo_usuario:
            correos.append(correo_usuario)

    # Limpiar correos vacíos y eliminar duplicados,
    # conservando el orden original.
    destinatarios_validos = list(
        dict.fromkeys(
            str(correo).strip()
            for correo in correos
            if correo and str(correo).strip()
        )
    )

    if not destinatarios_validos:
        logger.warning(
            (
                "No se programó la notificación. "
                "evento=%s tarea_id=%s motivo=sin_destinatarios"
            ),
            evento,
            getattr(tarea, "pk", None),
        )

        return False

    contexto = contexto_detalles_tarea(tarea)
    contexto["nombre_destinatario"] = obtener_nombre_usuario(
        usuario_destinatario
    )
    contexto["mensaje"] = mensaje

    if contexto_adicional:
        contexto.update(contexto_adicional)

    transaction.on_commit(
        partial(
            enviar_notificacion_email,
            evento=evento,
            destinatarios=destinatarios_validos,
            contexto=contexto,
        )
    )

    logger.info(
        (
            "Notificación programada. "
            "evento=%s tarea_id=%s destinatarios=%s"
        ),
        evento,
        tarea.pk,
        destinatarios_validos,
    )

    return True


def programar_correo_equipo(
    *,
    evento,
    tarea,
    mensaje,
    contexto_adicional=None,
):
    """
    Programa una notificación por correo para los integrantes del equipo
    de la tarea (líder + miembros ACTIVO) que tengan habilitado el evento.

    Devuelve True si la notificación quedó programada.
    Devuelve False si no encontró destinatarios válidos.
    """

    if tarea is None:
        raise ValueError(
            "La tarea es obligatoria para programar el correo."
        )

    equipo = getattr(tarea, "equipo", None)

    if equipo is None:
        return False

    destinatarios_validos = destinatarios_equipo(equipo, evento)

    if not destinatarios_validos:
        logger.info(
            (
                "No se programó la notificación de equipo. "
                "evento=%s tarea_id=%s motivo=sin_destinatarios"
            ),
            evento,
            getattr(tarea, "pk", None),
        )

        return False

    contexto = contexto_detalles_tarea(tarea)
    contexto["nombre_destinatario"] = (
        getattr(equipo, "nombre", "") or "equipo"
    )
    contexto["mensaje"] = mensaje

    if contexto_adicional:
        contexto.update(contexto_adicional)

    transaction.on_commit(
        partial(
            enviar_notificacion_email,
            evento=evento,
            destinatarios=destinatarios_validos,
            contexto=contexto,
        )
    )

    logger.info(
        (
            "Notificación de equipo programada. "
            "evento=%s tarea_id=%s destinatarios=%s"
        ),
        evento,
        tarea.pk,
        destinatarios_validos,
    )

    return True