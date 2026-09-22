import logging

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string


logger = logging.getLogger(__name__)


EVENTOS_EMAIL = {
    "SOLICITUD_CREADA": {
        "asunto": "Solicitud {codigo} registrada correctamente",
        "template": "emails/solicitud_creada.html",
    },
    "SOLICITUD_APROBADA": {
        "asunto": "Solicitud {codigo} aprobada",
        "template": "emails/solicitud_aprobada.html",
    },
    "SOLICITUD_RECHAZADA": {
        "asunto": "Solicitud {codigo} rechazada",
        "template": "emails/solicitud_rechazada.html",
    },
    "SOLICITUD_STANDBY": {
        "asunto": "Solicitud {codigo} en pausa",
        "template": "emails/solicitud_standby.html",
    },
    "SOLICITUD_FINALIZADA": {
        "asunto": "Solicitud {codigo} solucionada",
        "template": "emails/solicitud_finalizada.html",
    },
    "EQUIPO_NUEVA_SOLICITUD": {
        "asunto": "Nueva solicitud en tu equipo: {codigo}",
        "template": "emails/equipo_nueva_solicitud.html",
    },
    "EQUIPO_PENDIENTE_REVISION": {
        "asunto": "Solicitud pendiente de revisión: {codigo}",
        "template": "emails/equipo_pendiente_revision.html",
    },
    "EQUIPO_ALERTA_DIARIA": {
        "asunto": "Alerta diaria - {equipo_nombre}",
        "template": "emails/equipo_alerta_diaria.html",
        "texto": "emails/equipo_alerta_diaria.txt",
    },
}


def enviar_notificacion_email(evento, destinatarios, contexto):
    """
    Envía una notificación por correo de forma síncrona.

    evento:
        Clave de EVENTOS_EMAIL.

    destinatarios:
        Lista de direcciones de correo.

    contexto:
        Diccionario con la información usada por la plantilla.
    """

    configuracion = EVENTOS_EMAIL.get(evento)

    if configuracion is None:
        raise ValueError(
            f"Evento de correo no reconocido: {evento}"
        )

    destinatarios_validos = [
        correo.strip()
        for correo in destinatarios
        if correo and correo.strip()
    ]

    if not destinatarios_validos:
        logger.warning(
            "La notificación %s no tiene destinatarios.",
            evento,
        )

        return {
            "enviado": False,
            "motivo": "SIN_DESTINATARIOS",
            "evento": evento,
        }

    asunto = configuracion["asunto"].format(**contexto)

    contenido_html = render_to_string(
        configuracion["template"],
        contexto,
    )

    contenido_texto = render_to_string(
        configuracion.get("texto", "emails/notificacion_base.txt"),
        contexto,
    )

    mensaje = EmailMultiAlternatives(
        subject=asunto,
        body=contenido_texto,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=destinatarios_validos,
    )

    mensaje.attach_alternative(
        contenido_html,
        "text/html",
    )

    try:
        enviados = mensaje.send(fail_silently=False)
    except Exception:
        logger.exception(
            "No se pudo enviar la notificación. evento=%s destinatarios=%s",
            evento,
            destinatarios_validos,
        )
        return {
            "enviado": False,
            "motivo": "ERROR_ENVIO",
            "evento": evento,
        }

    logger.info(
        "Notificación enviada. evento=%s destinatarios=%s",
        evento,
        destinatarios_validos,
    )

    return {
        "enviado": enviados > 0,
        "procesados": enviados,
        "evento": evento,
        "destinatarios": destinatarios_validos,
    }
