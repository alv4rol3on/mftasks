import logging

from celery import shared_task
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
    "SOLICITUD_FINALIZADA": {
        "asunto": "Solicitud {codigo} finalizada",
        "template": "emails/solicitud_finalizada.html",
    },
}


@shared_task(
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_kwargs={"max_retries": 3},
)
def enviar_notificacion_email(
    self,
    evento,
    destinatarios,
    contexto,
):
    """
    Envía una notificación por correo en segundo plano.

    evento:
        SOLICITUD_CREADA, SOLICITUD_APROBADA, etc.

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
        "emails/notificacion_base.txt",
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

    enviados = mensaje.send(fail_silently=False)

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