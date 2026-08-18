from django.shortcuts import render
from .serializers import *
from rest_framework.viewsets import ModelViewSet
from .models import Cliente
from usuarios.permissions import EsAdministrador, IsAuthenticatedActivo

class ClienteViewSet(ModelViewSet):

    queryset = Cliente.objects.all()

    serializer_class = ClienteSerializer

    permission_classes = [IsAuthenticatedActivo]

    def get_permissions(self):

        permisos = super().get_permissions()

        if self.action in ("create", "update", "partial_update", "destroy"):
            permisos += [EsAdministrador()]

        return permisos