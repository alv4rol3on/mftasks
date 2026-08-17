from rest_framework.routers import DefaultRouter
from .views import *

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

urlpatterns = router.urls