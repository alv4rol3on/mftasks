from channels.generic.websocket import AsyncJsonWebsocketConsumer


class TareaConsumer(AsyncJsonWebsocketConsumer):

    async def connect(self):

        self.tarea_id = self.scope["url_route"]["kwargs"]["tarea_id"]

        self.group_name = f"tarea_{self.tarea_id}"

        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name,
        )

        await self.accept()

        await self.send_json({
            "type": "CONEXION_ESTABLECIDA",
            "tarea_id": self.tarea_id,
        })


    async def disconnect(self, close_code):

        await self.channel_layer.group_discard(
            self.group_name,
            self.channel_name,
        )


    async def task_status_changed(self, event):

        await self.send_json(event)