import asyncio
import time

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer

from .permissions import puede_observar_tarea


class TareaConsumer(AsyncJsonWebsocketConsumer):

    async def connect(self):

        self.tarea_id = self.scope["url_route"]["kwargs"]["tarea_id"]

        usuario = self.scope.get("user")

        permitido = await self._puede_observar(usuario)

        if not permitido:
            await self.close(code=4403)
            return

        self.group_name = f"tarea_{self.tarea_id}"

        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name,
        )

        subprotocolos = self.scope.get("subprotocols") or []
        subprotocolo = (
            "access_token"
            if len(subprotocolos) >= 2
            and subprotocolos[0] == "access_token"
            else None
        )

        await self.accept(subprotocol=subprotocolo)

        await self.send_json({
            "type": "CONEXION_ESTABLECIDA",
            "tarea_id": self.tarea_id,
        })

        exp = self.scope.get("token_exp")

        if exp:
            self._expira = asyncio.create_task(
                self._cerrar_al_expirar(float(exp) - time.time())
            )

    async def _cerrar_al_expirar(self, restante):
        try:
            await asyncio.sleep(max(0, restante))
            await self.close(code=4401)
        except asyncio.CancelledError:
            pass

    @database_sync_to_async
    def _puede_observar(self, usuario):
        from .models import Tarea

        try:
            tarea = Tarea.objects.select_related(
                "equipo", "solicitante"
            ).get(id=self.tarea_id)
        except Tarea.DoesNotExist:
            return False

        return puede_observar_tarea(usuario, tarea)

    async def disconnect(self, close_code):

        tarea_expiracion = getattr(self, "_expira", None)

        if tarea_expiracion:
            tarea_expiracion.cancel()

        group_name = getattr(self, "group_name", None)

        if not group_name:
            return

        await self.channel_layer.group_discard(
            group_name,
            self.channel_name,
        )

    async def task_status_changed(self, event):

        await self.send_json(event)

    async def subtask_status_changed(self, event):

        await self.send_json(event)
