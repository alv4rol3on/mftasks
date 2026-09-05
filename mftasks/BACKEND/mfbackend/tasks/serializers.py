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
    tiempo_tomado_segundos = serializers.SerializerMethodField()
    tiempo_tomado_horas = serializers.SerializerMethodField()
    tiempo_tomado_formateado = serializers.SerializerMethodField()

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
            "fecha_fin_standby",
            "standby_por",
            "bloqueada_por",
            "dependencias",
            "tiempo_tomado_segundos",
            "tiempo_tomado_horas",
            "tiempo_tomado_formateado",
        ]
        read_only_fields = ["motivo_standby", "fecha_standby", "fecha_fin_standby", "standby_por", "tiempo_tomado_segundos", "tiempo_tomado_horas", "tiempo_tomado_formateado"]

    def get_bloqueada_por(self, obj):
        # lista de ids bloqueadoras no solucionadas
        deps = obj.dependencias_origen.select_related("bloqueadora").all()
        return [{"id": d.bloqueadora_id, "estado": d.bloqueadora.estado, "descripcion": d.bloqueadora.descripcion} for d in deps]

    def get_asignado_nombre(self, obj):
        return f"{obj.asignado.nombres} {obj.asignado.apellidos}"

    def _tiempo_tomado(self, obj):
        try:
            from .services.tiempo_laboral import calcular_tiempo_tomado_subtarea
            return calcular_tiempo_tomado_subtarea(obj)
        except Exception:
            return None

    def get_tiempo_tomado_segundos(self, obj):
        td = self._tiempo_tomado(obj)
        if td is None:
            return None
        # solo si está solucionada o tiene ambas fechas, si no 0
        if not obj.fecha_inicio or not obj.fecha_fin:
            return 0 if obj.estado == "SOLUCIONADO" else None
        return int(td.total_seconds())

    def get_tiempo_tomado_horas(self, obj):
        seg = self.get_tiempo_tomado_segundos(obj)
        if seg is None:
            return None
        return round(seg / 3600, 2)

    def get_tiempo_tomado_formateado(self, obj):
        seg = self.get_tiempo_tomado_segundos(obj)
        if seg is None:
            return None
        # reutiliza formateo d h m s
        dias = seg // 86400
        horas = (seg % 86400) // 3600
        minutos = (seg % 3600) // 60
        segundos = seg % 60
        return f"{dias}d {horas:02d}h {minutos:02d}m {segundos:02d}s"


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
    tiempo_tomado_segundos = serializers.SerializerMethodField()
    tiempo_tomado_horas = serializers.SerializerMethodField()
    tiempo_tomado_formateado = serializers.SerializerMethodField()
    tiempo_planificado_segundos = serializers.SerializerMethodField()

    class Meta:
        model = Tarea
        fields = ["id", "ticket", "asunto", "descripcion", "cliente", "cliente_nombre", "campana_nombre", "subcampana", "subcampana_nombre", "equipo", "equipo_nombre", "aprobador", "aprobador_nombre", "solicitante", "solicitante_nombre", "estado", "motivo_rechazo", "motivo_standby", "fecha_standby", "fecha_fin_standby", "standby_por", "fecha_solucion", "fecha_creacion", "fecha_respuesta", "fecha_inicio", "fecha_entrega_aproximada", "incluye_sabado", "progreso", "subtareas", "puedo_operar", "tiempo_tomado_segundos", "tiempo_tomado_horas", "tiempo_tomado_formateado", "tiempo_planificado_segundos"]
        read_only_fields = ["estado", "progreso", "fecha_respuesta", "fecha_inicio", "fecha_entrega_aproximada", "motivo_rechazo", "aprobador", "solicitante", "ticket", "motivo_standby", "fecha_standby", "fecha_fin_standby", "standby_por", "fecha_solucion", "tiempo_tomado_segundos", "tiempo_tomado_horas", "tiempo_tomado_formateado", "tiempo_planificado_segundos"]

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

    def _tiempo_tomado_tarea(self, obj):
        try:
            from .services.tiempo_laboral import calcular_tiempo_tomado_tarea, calcular_tiempo_planificado_tarea
            return calcular_tiempo_tomado_tarea(obj), calcular_tiempo_planificado_tarea(obj)
        except Exception:
            return None, None

    def get_tiempo_tomado_segundos(self, obj):
        tomado, _ = self._tiempo_tomado_tarea(obj)
        if tomado is None:
            return None
        if not obj.fecha_inicio or not obj.fecha_solucion:
            return 0 if obj.estado == "SOLUCIONADO" else None
        return int(tomado.total_seconds())

    def get_tiempo_tomado_horas(self, obj):
        seg = self.get_tiempo_tomado_segundos(obj)
        if seg is None:
            return None
        return round(seg / 3600, 2)

    def get_tiempo_tomado_formateado(self, obj):
        seg = self.get_tiempo_tomado_segundos(obj)
        if seg is None:
            return None
        dias = seg // 86400
        horas = (seg % 86400) // 3600
        minutos = (seg % 3600) // 60
        segundos = seg % 60
        return f"{dias}d {horas:02d}h {minutos:02d}m {segundos:02d}s"

    def get_tiempo_planificado_segundos(self, obj):
        _, plan = self._tiempo_tomado_tarea(obj)
        if plan is None:
            return None
        if not obj.fecha_inicio or not obj.fecha_entrega_aproximada:
            return None
        return int(plan.total_seconds())

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
