from asgiref.sync import async_to_sync
from channels.routing import URLRouter
from channels.testing import WebsocketCommunicator
from django.contrib.auth import get_user_model
from django.test import TransactionTestCase
from rest_framework_simplejwt.tokens import RefreshToken

from usuarios.models import Equipo

from .middleware import JwtAuthMiddleware
from .models import Tarea
from .routing import websocket_urlpatterns

User = get_user_model()

application = JwtAuthMiddleware(URLRouter(websocket_urlpatterns))


class TareaConsumerTests(TransactionTestCase):

    def setUp(self):
        self.lider = User.objects.create_user(
            email="lider@example.com",
            password="x",
            nombres="Líder",
            apellidos="Test",
        )
        self.ajeno = User.objects.create_user(
            email="ajeno@example.com",
            password="x",
            nombres="Ajeno",
            apellidos="Test",
        )
        self.equipo = Equipo.objects.create(nombre="Equipo WS", lider=self.lider)
        self.tarea = Tarea.objects.create(
            asunto="Prueba WS",
            descripcion="...",
            equipo=self.equipo,
            solicitante=self.lider,
        )

    def _token(self, user):
        return str(RefreshToken.for_user(user).access_token)

    def _conectar(self, token):
        path = f"/ws/tareas/{self.tarea.id}/"
        if token:
            path += f"?token={token}"

        async def run():
            communicator = WebsocketCommunicator(application, path)
            connected, _ = await communicator.connect()
            if not connected:
                return False, None
            mensaje = await communicator.receive_json_from()
            await communicator.disconnect()
            return True, mensaje

        return async_to_sync(run)()

    def test_conexion_autorizada_lider(self):
        conectado, mensaje = self._conectar(self._token(self.lider))

        self.assertTrue(conectado)
        self.assertEqual(mensaje["type"], "CONEXION_ESTABLECIDA")
        self.assertEqual(mensaje["tarea_id"], self.tarea.id)

    def test_conexion_sin_token_rechazada(self):
        conectado, _ = self._conectar(None)

        self.assertFalse(conectado)

    def test_conexion_sin_permiso_rechazada(self):
        conectado, _ = self._conectar(self._token(self.ajeno))

        self.assertFalse(conectado)

    def test_recibe_evento_de_tarea(self):
        token = self._token(self.lider)

        async def run():
            communicator = WebsocketCommunicator(
                application, f"/ws/tareas/{self.tarea.id}/?token={token}"
            )
            connected, _ = await communicator.connect()
            self.assertTrue(connected)

            await communicator.receive_json_from()

            from channels.layers import get_channel_layer

            await get_channel_layer().group_send(
                f"tarea_{self.tarea.id}",
                {
                    "type": "task_status_changed",
                    "task_id": self.tarea.id,
                    "estado_nuevo": "EN_DESARROLLO",
                    "progreso": 50.0,
                },
            )

            evento = await communicator.receive_json_from()
            await communicator.disconnect()
            return evento

        evento = async_to_sync(run)()

        self.assertEqual(evento["type"], "task_status_changed")
        self.assertEqual(evento["estado_nuevo"], "EN_DESARROLLO")
        self.assertEqual(evento["progreso"], 50.0)
