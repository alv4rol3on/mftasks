from django.urls import include, path
from rest_framework.routers import DefaultRouter
from .views import CampanaViewSet, SubCampanaViewSet, PermisoCampanaViewSet

router = DefaultRouter()
router.register(r"campanas", CampanaViewSet, basename="campana")
router.register(r"subcampanas", SubCampanaViewSet, basename="subcampana")
router.register(r"permisos", PermisoCampanaViewSet, basename="permiso-campana")

urlpatterns = [path("", include(router.urls))]
