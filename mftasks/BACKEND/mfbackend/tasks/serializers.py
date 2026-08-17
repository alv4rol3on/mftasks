from rest_framework import serializers
from .models import Tarea

class TaskSerializer(serializers.ModelSerializer):

    class Meta:
        model = Tarea
        fields = "__all__"