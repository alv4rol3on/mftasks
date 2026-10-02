from rest_framework import serializers
from usuarios.permissions import es_administrador, es_cliente
from .models import ArchivoTarea, Subtarea, Tarea
from .permissions import es_asignador_del_equipo


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
            "codigo",
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
            "activo",
            "fecha_inactivacion",
            "inactivada_por",
        ]
        read_only_fields = ["codigo", "motivo_standby", "fecha_standby", "fecha_fin_standby", "standby_por", "tiempo_tomado_segundos", "tiempo_tomado_horas", "tiempo_tomado_formateado", "fecha_inactivacion", "inactivada_por"]

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
        # HH:MM:SS con horas totales
        horas = seg // 3600
        minutos = (seg % 3600) // 60
        segundos = seg % 60
        return f"{horas:02d}:{minutos:02d}:{segundos:02d}"

class ArchivoTareaSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()
    subido_por_nombre = serializers.SerializerMethodField()

    class Meta:
        model = ArchivoTarea
        fields = [
            "id",
            "nombre",
            "archivo",
            "url",
            "fecha_subida",
            "subido_por",
            "subido_por_nombre",
        ]
        read_only_fields = [
            "id",
            "nombre",
            "archivo",
            "url",
            "fecha_subida",
            "subido_por",
            "subido_por_nombre",
        ]

    def get_url(self, obj):
        if not obj.archivo:
            return None

        return obj.archivo.url

    def get_subido_por_nombre(self, obj):
        if not obj.subido_por:
            return None

        return f"{obj.subido_por.nombres} {obj.subido_por.apellidos}"

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

    paso_aprobacion_nombre = serializers.SerializerMethodField()
    aprobaciones = serializers.SerializerMethodField()
    puedo_aprobar = serializers.SerializerMethodField()

    puedo_operar = serializers.SerializerMethodField()
    tiempo_tomado_segundos = serializers.SerializerMethodField()
    tiempo_tomado_horas = serializers.SerializerMethodField()
    tiempo_tomado_formateado = serializers.SerializerMethodField()
    tiempo_planificado_segundos = serializers.SerializerMethodField()
    fuera_de_tiempo = serializers.SerializerMethodField()
    archivos = ArchivoTareaSerializer(
        many=True,
        read_only=True,
    )

    class Meta:
        model = Tarea
        fields = ["id", "ticket", "asunto", "descripcion", "cliente", "cliente_nombre", "campana_nombre", "subcampana", "subcampana_nombre", "equipo", "equipo_nombre", "aprobador", "aprobador_nombre", "solicitante", "solicitante_nombre", "estado", "paso_aprobacion", "paso_aprobacion_nombre", "aprobaciones", "puedo_aprobar", "motivo_rechazo", "motivo_standby", "fecha_standby", "fecha_fin_standby", "standby_por", "fecha_solucion", "fecha_creacion", "fecha_respuesta", "fecha_inicio", "fecha_entrega_aproximada", "incluye_sabado", "progreso", "subtareas", "puedo_operar", "tiempo_tomado_segundos", "tiempo_tomado_horas", "tiempo_tomado_formateado", "tiempo_planificado_segundos", "fuera_de_tiempo", "activo", "fecha_inactivacion", "inactivada_por", "archivos"]
        read_only_fields = ["estado", "progreso", "fecha_respuesta", "fecha_inicio", "fecha_entrega_aproximada", "motivo_rechazo", "aprobador", "solicitante", "ticket", "motivo_standby", "fecha_standby", "fecha_fin_standby", "standby_por", "fecha_solucion", "tiempo_tomado_segundos", "tiempo_tomado_horas", "tiempo_tomado_formateado", "tiempo_planificado_segundos", "fuera_de_tiempo", "activo", "fecha_inactivacion", "inactivada_por"]

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

    def get_paso_aprobacion_nombre(self, obj):
        from usuarios.jerarquia import nombre_nivel
        return nombre_nivel(obj.paso_aprobacion)

    def get_aprobaciones(self, obj):
        registros = obj.aprobaciones.select_related("usuario").all()
        return [
            {
                "id": r.id,
                "nivel": r.nivel,
                "accion": r.accion,
                "usuario": r.usuario_id,
                "usuario_nombre": (
                    f"{r.usuario.nombres} {r.usuario.apellidos}"
                    if r.usuario
                    else None
                ),
                "motivo": r.motivo,
                "fecha": r.fecha.isoformat() if r.fecha else None,
            }
            for r in registros
        ]

    def get_puedo_aprobar(self, obj):
        request = self.context.get("request")
        if request is None:
            return False
        if obj.estado != Tarea.Estado.EN_ESPERA:
            return False
        from .permissions import es_aprobador_de_tarea
        return es_aprobador_de_tarea(request.user, obj)

    def get_subtareas(self, obj):
        return SubtareaSerializer(obj.subtareas.all(), many=True).data

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
        horas = seg // 3600
        minutos = (seg % 3600) // 60
        segundos = seg % 60
        return f"{horas:02d}:{minutos:02d}:{segundos:02d}"

    def get_tiempo_planificado_segundos(self, obj):
        _, plan = self._tiempo_tomado_tarea(obj)
        if plan is None:
            return None
        if not obj.fecha_inicio or not obj.fecha_entrega_aproximada:
            return None
        return int(plan.total_seconds())

    def get_fuera_de_tiempo(self, obj):
        # Solo se calcula cuando el cliente lo pide (?con_retraso=1) para no
        # encarecer el listado en vistas que no lo necesitan.
        request = self.context.get("request")
        if request is None:
            return None
        valor = str(request.query_params.get("con_retraso", "")).lower()
        if valor not in ("1", "true", "yes"):
            return None
        try:
            from .services.tiempo_laboral import esta_fuera_de_tiempo_tarea
            return bool(esta_fuera_de_tiempo_tarea(obj))
        except Exception:
            return None

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
            # Bloqueo universal: si campaña/subcampaña inhabilitada, nadie puede crear (incluye Admin)
            if subcampana_obj:
                if not subcampana_obj.activo or not subcampana_obj.campana.activo:
                    raise serializers.ValidationError({"subcampana": "La campaña/subcampaña está inhabilitada por Administración y no está disponible para crear tareas."})
            if subcampana_obj and request and es_cliente(request.user) and not es_administrador(request.user):
                from .permissions import tiene_permiso_subcampana
                if not tiene_permiso_subcampana(request.user, subcampana_obj):
                    raise serializers.ValidationError({"subcampana": f"No tienes permiso para {subcampana_obj.codigo}."})
            # compat: si viene cliente, ignorar (derivado de subcampana)
            attrs.pop("cliente", None)
        return attrs
