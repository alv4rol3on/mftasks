from django.urls import path

from . import consumers


websocket_urlpatterns = [
    path(
        "ws/tareas/<int:tarea_id>/",
        consumers.TareaConsumer.as_asgi(),
    ),
]