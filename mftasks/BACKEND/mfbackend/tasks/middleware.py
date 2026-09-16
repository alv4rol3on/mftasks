from urllib.parse import parse_qs

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
    """Autentica el websocket con el access token JWT enviado como ?token=."""

    def __init__(self, inner):
        self.inner = inner

    async def __call__(self, scope, receive, send):
        token = None
        query_string = scope.get("query_string", b"")

        if query_string:
            params = parse_qs(query_string.decode())
            token = params.get("token", [None])[0]

        if token:
            scope["user"] = await _usuario_desde_token(token)
        else:
            scope["user"] = AnonymousUser()

        return await self.inner(scope, receive, send)
