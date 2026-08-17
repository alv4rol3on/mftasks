from rest_framework import viewsets

from .models import Tarea
from .serializers import TaskSerializer


class TaskViewSet(viewsets.ModelViewSet):
    queryset = Tarea.objects.all()
    serializer_class = TaskSerializer