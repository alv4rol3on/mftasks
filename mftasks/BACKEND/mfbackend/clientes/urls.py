from rest_framework.routers import DefaultRouter

from .views import EntidadViewSet

router = DefaultRouter()
router.register(r"entidades", EntidadViewSet, basename="entidad")

urlpatterns = router.urls
