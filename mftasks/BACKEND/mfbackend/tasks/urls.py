from rest_framework.routers import DefaultRouter
from .views import TaskViewSet, HorarioLaboralViewSet, ConfiguracionAprobacionViewSet

router = DefaultRouter()

router.register(r"tasks", TaskViewSet, basename="task")
router.register(r"horarios-laborales", HorarioLaboralViewSet, basename="horario-laboral")
router.register(r"configuracion-aprobacion", ConfiguracionAprobacionViewSet, basename="configuracion-aprobacion")

urlpatterns = router.urls