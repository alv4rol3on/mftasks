from rest_framework import serializers
from .models import Subtarea, Tarea
from .permissions import es_asignador_del_equipo


def _es_asistente_visibilidad_limitada(user):
    if not user or not user.is_authenticated:
        return False
    if user.roles.filter(rol__nombre__iexact="Administrador").exists():
        return False
    if user.roles.filter(rol__nombre__iexact="ASIGNADOR").exists():
        return False
    # si es lider de algún equipo, se considera asignador
    from usuarios.models import Equipo
    if Equipo.objects.filter(lider=user).exists():
        return False
    # Solo asistentes explícitos tienen visibilidad limitada
    if not user.roles.filter(rol__nombre__iexact="ASISTENTE").exists():
        return False
    return True


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

    solicitante_nombre = serializers.SerializerMethodField()

    subtareas = serializers.SerializerMethodField()

    puedo_operar = serializers.SerializerMethodField()

    class Meta:
        model = Tarea
        fields = "__all__"
        read_only_fields = ["estado", "progreso", "fecha_respuesta", "fecha_inicio", "fecha_entrega_aproximada", "motivo_rechazo", "aprobador", "solicitante"]

    def get_aprobador_nombre(self, obj):
        if not obj.aprobador:
            return None
        return f"{obj.aprobador.nombres} {obj.aprobador.apellidos}"

    def get_solicitante_nombre(self, obj):
        if not obj.solicitante:
            return None
        return f"{obj.solicitante.nombres} {obj.solicitante.apellidos}"

    def get_subtareas(self, obj):
        request = self.context.get("request")
        qs = obj.subtareas.all()
        if request and _es_asistente_visibilidad_limitada(request.user):
            qs = qs.filter(asignado=request.user)
        return SubtareaSerializer(qs, many=True).data

    def get_puedo_operar(self, obj):
        request = self.context.get("request")
        if request is None:
            return False
        return es_asignador_del_equipo(request.user, obj.equipo)

    def validate(self, attrs):
        request = self.context.get("request")
        if request and request.method == "POST":
            # CLIENTE no puede setear estado/progreso/aprobador manualmente
            if "estado" in self.initial_data and self.initial_data.get("estado") != "EN_ESPERA":
                raise serializers.ValidationError({"estado": "No puede definir el estado al crear."})
        return attrs
