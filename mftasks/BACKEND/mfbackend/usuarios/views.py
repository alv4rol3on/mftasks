from .serializers import *
from rest_framework.viewsets import ModelViewSet

class UserViewSet(ModelViewSet):

    queryset = User.objects.all()

    serializer_class = UserSerializer

class RolViewSet(ModelViewSet):

    queryset = Rol.objects.all()

    serializer_class = RolSerializer

class EquipoViewSet(ModelViewSet):

    queryset = Equipo.objects.all()

    serializer_class = EquipoDetailSerializer

