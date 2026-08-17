from django.shortcuts import render
from .serializers import *
from rest_framework.viewsets import ModelViewSet
from .models import Cliente

class UserViewSet(ModelViewSet):

    queryset = Cliente.objects.all()

    serializer_class = ClienteSerializer