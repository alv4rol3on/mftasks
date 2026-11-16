from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import AccessToken


@database_sync_to_async
def _usuario_desde_token(token):
    from django.contrib.auth import get_user_model

    User = get_user_model()

    try:
        validated = AccessToken(token)
        usuario = User.objects.get(id=validated["user_id"])
    except (TokenError, KeyError, User.DoesNotExist):
        return AnonymousUser()

    if not usuario.is_active:
        return AnonymousUser()

    return usuario


class JwtAuthMiddleware:
    """Autentica el websocket con el token enviado como subprotocolo.

    El cliente abre el socket con:
        new WebSocket(url, ["access_token", "<jwt>"])

    Así el token no viaja en la URL ni queda registrado en los logs de
    acceso del proxy.
    """

    SUBPROTOCOLO = "access_token"

    def __init__(self, inner):
        self.inner = inner

    async def __call__(self, scope, receive, send):
        token = None
        subprotocolos = scope.get("subprotocols") or []

        if (
            len(subprotocolos) >= 2
            and subprotocolos[0] == self.SUBPROTOCOLO
        ):
            token = subprotocolos[1]

        if token:
            scope["user"] = await _usuario_desde_token(token)
        else:
            scope["user"] = AnonymousUser()

        return await self.inner(scope, receive, send)
