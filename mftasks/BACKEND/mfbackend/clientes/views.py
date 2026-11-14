from rest_framework.viewsets import ModelViewSet

from usuarios.permissions import EsAdministrador, IsAuthenticatedActivo

from .models import Entidad
from .serializers import EntidadSerializer


class EntidadViewSet(ModelViewSet):
    queryset = Entidad.objects.all()
    serializer_class = EntidadSerializer
    permission_classes = [IsAuthenticatedActivo, EsAdministrador]
