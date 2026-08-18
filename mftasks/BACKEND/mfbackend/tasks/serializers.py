from rest_framework import serializers
from .models import Subtarea, Tarea
from .permissions import es_asignador_del_equipo


class SubtareaSerializer(serializers.ModelSerializer):

    asignado_nombre = serializers.SerializerMethodField()

    class Meta:
        model = Subtarea
        fields = [
            "id",
            "tarea",
            "descripcion",
            "asignado",
            "asignado_nombre",
            "estado",
            "peso",
            "fecha_creacion",
            "fecha_inicio",
            "fecha_fin",
        ]

    def get_asignado_nombre(self, obj):
        return f"{obj.asignado.nombres} {obj.asignado.apellidos}"


class TaskSerializer(serializers.ModelSerializer):

    cliente_nombre = serializers.CharField(
        source="cliente.nombre",
        read_only=True,
    )

    equipo_nombre = serializers.CharField(
        source="equipo.nombre",
        read_only=True,
    )

    aprobador_nombre = serializers.SerializerMethodField()

    subtareas = SubtareaSerializer(many=True, read_only=True)

    puedo_operar = serializers.SerializerMethodField()

    class Meta:
        model = Tarea
        fields = "__all__"

    def get_aprobador_nombre(self, obj):
        if not obj.aprobador:
            return None
        return f"{obj.aprobador.nombres} {obj.aprobador.apellidos}"

    def get_puedo_operar(self, obj):
        request = self.context.get("request")
        if request is None:
            return False
        return es_asignador_del_equipo(request.user, obj.equipo)
