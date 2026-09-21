import logging
from functools import partial

from django.db import transaction

from tasks.tasks import enviar_notificacion_email


logger = logging.getLogger(__name__)


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

    contexto = {
        "codigo": obtener_codigo_tarea(tarea),
        "titulo": obtener_titulo_tarea(tarea),
        "estado": obtener_estado_tarea(tarea),
        "nombre_destinatario": obtener_nombre_usuario(
            usuario_destinatario
        ),
        "mensaje": mensaje,
    }

    if contexto_adicional:
        contexto.update(contexto_adicional)

    transaction.on_commit(
        partial(
            enviar_notificacion_email.delay,
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