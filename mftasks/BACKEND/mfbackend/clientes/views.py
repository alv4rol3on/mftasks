from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from campanas.services import eliminar_entidad, restaurar_entidad
from usuarios.permissions import EsAdministrador, IsAuthenticatedActivo

from .models import Entidad
from .serializers import EntidadSerializer


def _incluir_eliminados(request):
    valor = str(request.query_params.get("incluir_eliminados", "")).lower()
    return valor in ("1", "true", "yes", "si")


class EntidadViewSet(ModelViewSet):
    queryset = Entidad.objects.all()
    serializer_class = EntidadSerializer
    permission_classes = [IsAuthenticatedActivo, EsAdministrador]

    def get_queryset(self):
        qs = super().get_queryset()
        if self.action == "restaurar" or _incluir_eliminados(self.request):
            return qs
        return qs.filter(eliminado=False, activo=True)

    def destroy(self, request, *args, **kwargs):
        entidad = self.get_object()
        resultado = eliminar_entidad(entidad, request.user)
        return Response(resultado, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="restaurar")
    def restaurar(self, request, pk=None):
        entidad = self.get_object()
        if not entidad.eliminado:
            return Response(
                {"detail": "La entidad no está eliminada."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        resultado = restaurar_entidad(entidad)
        codigo = (
            status.HTTP_200_OK
            if resultado["restaurados"]
            else status.HTTP_400_BAD_REQUEST
        )
        return Response(resultado, status=codigo)
