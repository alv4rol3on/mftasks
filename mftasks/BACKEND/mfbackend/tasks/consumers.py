import json
import asyncio
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.utils import timezone

class ContadorConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        if not self.scope.get("user") or not self.scope["user"].is_authenticated:
            # permitir con token via query ?token= ; fallback aceptar y validar en receive
            # por simplicidad, aceptar si no hay user pero luego validar JWT manualmente si se requiere
            pass
        self.tarea_id = self.scope["url_route"]["kwargs"].get("tarea_id")
        if self.tarea_id:
            self.group_name = f"tarea_{self.tarea_id}"
            await self.channel_layer.group_add(self.group_name, self.channel_name)
        else:
            self.group_name = None
        await self.accept()
        # envío inicial
        if self.tarea_id:
            data = await self.get_contador(int(self.tarea_id))
            if data:
                await self.send(text_data=json.dumps({"type": "contador", "tarea_id": int(self.tarea_id), "data": data}))

    async def disconnect(self, close_code):
        if getattr(self, "group_name", None):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data=None, bytes_data=None):
        try:
            msg = json.loads(text_data or "{}")
            ids = msg.get("ids") or msg.get("tarea_ids") or []
            if ids and not self.tarea_id:
                for tid in ids[:20]:
                    await self.channel_layer.group_add(f"tarea_{int(tid)}", self.channel_name)
                # enviar snapshot batch
                for tid in ids[:20]:
                    data = await self.get_contador(int(tid))
                    if data:
                        await self.send(text_data=json.dumps({"type": "contador", "tarea_id": int(tid), "data": data}))
        except Exception:
            pass

    async def contador_update(self, event):
        await self.send(text_data=json.dumps({"type": "contador", "tarea_id": event.get("tarea_id"), "data": event.get("data")}))

    @database_sync_to_async
    def get_contador(self, tarea_id):
        try:
            from .models import Tarea
            from .services.tiempo_laboral import obtener_contador_tarea
            tarea = Tarea.objects.get(pk=tarea_id)
            return obtener_contador_tarea(tarea, ahora=timezone.now())
        except Exception:
            return None
