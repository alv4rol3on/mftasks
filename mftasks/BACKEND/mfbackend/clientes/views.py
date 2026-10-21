from rest_framework.viewsets import ModelViewSet

from usuarios.permissions import EsAdministrador, IsAuthenticatedActivo

from .models import Entidad
from .serializers import EntidadSerializer


class EntidadViewSet(ModelViewSet):
    queryset = Entidad.objects.all()
    serializer_class = EntidadSerializer
    permission_classes = [IsAuthenticatedActivo]

    def get_permissions(self):
        permisos = super().get_permissions()

        if self.action in ("create", "update", "partial_update", "destroy"):
            permisos += [EsAdministrador()]

        return permisos
