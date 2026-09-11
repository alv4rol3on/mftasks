from django.urls import re_path
from .consumers import ContadorConsumer

websocket_urlpatterns = [
    re_path(r"ws/contador/(?P<tarea_id>\d+)/$", ContadorConsumer.as_asgi()),
    re_path(r"ws/contadores/$", ContadorConsumer.as_asgi()),
]
