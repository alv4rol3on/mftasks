from django.urls import path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    EquipoViewSet,
    MeView,
    MicrosoftLoginView,
    RolViewSet,
    UserViewSet,
)

router = DefaultRouter()

router.register(
    "usuarios",
    UserViewSet
)

router.register(
    "roles",
    RolViewSet
)

router.register(
    "equipos",
    EquipoViewSet
)

urlpatterns = [
    path("auth/microsoft/", MicrosoftLoginView.as_view(), name="microsoft-login"),
    path("auth/me/", MeView.as_view(), name="me"),
    path("auth/refresh/", TokenRefreshView.as_view(), name="token-refresh"),
] + router.urls