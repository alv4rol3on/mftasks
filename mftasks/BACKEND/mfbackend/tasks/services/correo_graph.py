import logging

import msal
import requests

from django.conf import settings


logger = logging.getLogger(__name__)


class ErrorCorreoGraph(Exception):
    """
    Error durante la autenticación o envío mediante
    Microsoft Graph.
    """


def obtener_token_graph():
    """
    Obtiene un token de aplicación para Microsoft Graph.
    """

    configuraciones = {
        "MAIL_TENANT_ID": settings.MAIL_TENANT_ID,
        "MAIL_CLIENT_ID": settings.MAIL_CLIENT_ID,
        "MAIL_CLIENT_SECRET": settings.MAIL_CLIENT_SECRET,
    }

    faltantes = [
        nombre
        for nombre, valor in configuraciones.items()
        if not str(valor or "").strip()
    ]

    if faltantes:
        raise ErrorCorreoGraph(
            "Faltan variables de Microsoft Graph: "
            + ", ".join(faltantes)
        )

    authority = (
        "https://login.microsoftonline.com/"
        f"{settings.MAIL_TENANT_ID.strip()}"
    )

    aplicacion = msal.ConfidentialClientApplication(
        client_id=settings.MAIL_CLIENT_ID.strip(),
        authority=authority,
        client_credential=(
            settings.MAIL_CLIENT_SECRET.strip()
        ),
    )

    resultado = aplicacion.acquire_token_for_client(
        scopes=["https://graph.microsoft.com/.default"]
    )

    access_token = resultado.get("access_token")

    if not access_token:
        logger.error(
            "No se pudo obtener token de Graph. error=%s",
            resultado.get("error"),
        )

        raise ErrorCorreoGraph(
            resultado.get("error_description")
            or "No se pudo obtener el token de Microsoft Graph."
        )

    return access_token


def enviar_correo_graph(
    *,
    destinatarios,
    asunto,
    contenido_html,
    contenido_texto,
):
    """
    Envía un correo desde MAIL_SENDER mediante
    Microsoft Graph.
    """

    remitente = str(
        settings.MAIL_SENDER or ""
    ).strip()

    if not remitente:
        raise ErrorCorreoGraph(
            "MAIL_SENDER no está configurado."
        )

    destinatarios_validos = list(
        dict.fromkeys(
            str(correo).strip()
            for correo in destinatarios
            if correo and str(correo).strip()
        )
    )

    if not destinatarios_validos:
        raise ErrorCorreoGraph(
            "El correo no tiene destinatarios."
        )

    access_token = obtener_token_graph()

    url = (
        "https://graph.microsoft.com/v1.0/"
        f"users/{remitente}/sendMail"
    )

    payload = {
        "message": {
            "subject": asunto,
            "body": {
                "contentType": "HTML",
                "content": contenido_html,
            },
            "toRecipients": [
                {
                    "emailAddress": {
                        "address": correo,
                    }
                }
                for correo in destinatarios_validos
            ],
        },
        "saveToSentItems": True,
    }

    respuesta = requests.post(
        url,
        headers={
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        },
        json=payload,
        timeout=30,
    )

    if respuesta.status_code != 202:
        logger.error(
            (
                "Microsoft Graph rechazó el correo. "
                "status=%s respuesta=%s"
            ),
            respuesta.status_code,
            respuesta.text,
        )

        raise ErrorCorreoGraph(
            "Microsoft Graph rechazó el correo. "
            f"HTTP {respuesta.status_code}: "
            f"{respuesta.text}"
        )

    logger.info(
        (
            "Microsoft Graph aceptó el correo. "
            "remitente=%s destinatarios=%s"
        ),
        remitente,
        destinatarios_validos,
    )

    return {
        "aceptado": True,
        "codigo_http": respuesta.status_code,
        "remitente": remitente,
        "destinatarios": destinatarios_validos,
    }