from rest_framework import serializers
from .models import Subtarea, Tarea
from .permissions import es_asignador_del_equipo


def _es_asistente_visibilidad_limitada(user):
    if not user or not user.is_authenticated:
        return False
    if user.roles.filter(rol__nombre__iexact="Administrador").exists():
        return False
    # lider por-equipo se considera asignador (nuevo modelo 4 roles)
    from usuarios.models import Equipo, EquipoMiembro
    if Equipo.objects.filter(lider=user).exists():
        return False
    if EquipoMiembro.objects.filter(usuario=user, rol_en_equipo=EquipoMiembro.RolEnEquipo.LIDER, estado=EquipoMiembro.EstadoMiembro.ACTIVO).exists():
        return False
    # compat: viejo ASIGNADOR todavía considerado asignador
    if user.roles.filter(rol__nombre__iexact="ASIGNADOR").exists():
        return False
    # cliente puro no es asistente
    if user.roles.filter(rol__nombre__iexact="CLIENTE").exists() and not user.roles.filter(rol__nombre__iexact="miembro").exists():
        return False
    # Solo miembros explícitos con visibilidad limitada: si tiene rol miembro pero no es lider, era asistente antes
    # Fase 1: con 4 roles, asistente ya no existe, retornamos False para no filtrar
    return False


class SubtareaSerializer(serializers.ModelSerializer):

    asignado_nombre = serializers.SerializerMethodField()
    bloqueada_por = serializers.SerializerMethodField()

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
            "motivo_standby",
            "fecha_standby",
            "standby_por",
            "bloqueada_por",
            "dependencias",
        ]
        read_only_fields = ["motivo_standby", "fecha_standby", "standby_por"]

    def get_bloqueada_por(self, obj):
        # lista de ids bloqueadoras no solucionadas
        deps = obj.dependencias_origen.select_related("bloqueadora").all()
        return [{"id": d.bloqueadora_id, "estado": d.bloqueadora.estado, "descripcion": d.bloqueadora.descripcion} for d in deps]

    def get_asignado_nombre(self, obj):
        return f"{obj.asignado.nombres} {obj.asignado.apellidos}"


class TaskSerializer(serializers.ModelSerializer):

    cliente_nombre = serializers.SerializerMethodField()
    campana_nombre = serializers.SerializerMethodField()
    subcampana_nombre = serializers.CharField(source="subcampana.nombre", read_only=True, default=None)
    # alias cliente para compat frontend que aún envía cliente
    cliente = serializers.IntegerField(write_only=True, required=False)

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
        fields = ["id", "ticket", "asunto", "descripcion", "cliente", "cliente_nombre", "campana_nombre", "subcampana", "subcampana_nombre", "equipo", "equipo_nombre", "aprobador", "aprobador_nombre", "solicitante", "solicitante_nombre", "estado", "motivo_rechazo", "motivo_standby", "fecha_standby", "standby_por", "fecha_solucion", "fecha_creacion", "fecha_respuesta", "fecha_inicio", "fecha_entrega_aproximada", "progreso", "subtareas", "puedo_operar"]
        read_only_fields = ["estado", "progreso", "fecha_respuesta", "fecha_inicio", "fecha_entrega_aproximada", "motivo_rechazo", "aprobador", "solicitante", "ticket", "motivo_standby", "fecha_standby", "standby_por", "fecha_solucion"]

    def get_cliente_nombre(self, obj):
        if obj.subcampana and obj.subcampana.campana:
            return obj.subcampana.campana.nombre
        return None

    def get_campana_nombre(self, obj):
        if obj.subcampana and obj.subcampana.campana:
            return obj.subcampana.campana.nombre
        return None

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
            # subcampana es obligatoria ahora (cliente derivado)
            subcampana = attrs.get("subcampana") or self.initial_data.get("subcampana")
            if not subcampana:
                raise serializers.ValidationError({"subcampana": "La subcampaña es obligatoria."})
            # resolver id -> objeto
            from campanas.models import SubCampana
            subcampana_obj = None
            try:
                if isinstance(subcampana, int):
                    subcampana_obj = SubCampana.objects.select_related("campana").get(id=subcampana)
                elif hasattr(subcampana, "campana"):
                    subcampana_obj = subcampana
                else:
                    subcampana_obj = SubCampana.objects.select_related("campana").get(id=int(subcampana))
            except Exception:
                subcampana_obj = None
            if subcampana_obj and request and request.user.roles.filter(rol__nombre__iexact="CLIENTE").exists() and not request.user.roles.filter(rol__nombre__iexact="Administrador").exists():
                from .permissions import tiene_permiso_subcampana
                if not tiene_permiso_subcampana(request.user, subcampana_obj):
                    raise serializers.ValidationError({"subcampana": f"No tienes permiso para {subcampana_obj.codigo}."})
            # compat: si viene cliente, ignorar (derivado de subcampana)
            attrs.pop("cliente", None)
        return attrs
