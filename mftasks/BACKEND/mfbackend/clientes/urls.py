from rest_framework.routers import DefaultRouter
from .views import clientesViewSet

router = DefaultRouter()

router.register(r"clientes", clientesViewSet)

urlpatterns = router.urls