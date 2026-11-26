from django.urls import path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    EquipoViewSet,
    LogoutView,
    MeView,
    MiDisponibilidadView,
    MicrosoftLoginView,
    NivelViewSet,
    PreferenciaNotificacionView,
    UserViewSet,
    MisPreferenciasNotificacionView
)

router = DefaultRouter()

router.register(
    "usuarios",
    UserViewSet
)

router.register(
    "niveles",
    NivelViewSet
)

router.register(
    "equipos",
    EquipoViewSet
)

urlpatterns = [
    path("auth/microsoft/", MicrosoftLoginView.as_view(), name="microsoft-login"),
    path("auth/me/", MeView.as_view(), name="me"),
    path("auth/refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    path("auth/logout/", LogoutView.as_view(), name="logout"),
    path("notificaciones/", PreferenciaNotificacionView.as_view(), name="notificaciones"),
    path("me/preferencias-notificacion/", MisPreferenciasNotificacionView.as_view(), name="mis-preferencias-notificacion"),
    path("me/disponibilidad/", MiDisponibilidadView.as_view(), name="mi-disponibilidad"),
] + router.urls