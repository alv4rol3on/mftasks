from rest_framework import serializers
from .models import *

class NivelSerializer(serializers.ModelSerializer):

    usuarios_count = serializers.SerializerMethodField()

    class Meta:
        model = Nivel
        fields = [
            "id",
            "nombre",
            "descripcion",
            "superior",
            "puede_liderar",
            "auto_aprobar",
            "puede_crear_solicitudes",
            "color",
            "activo",
            "es_sistema",
            "usuarios_count",
        ]
        read_only_fields = ["nombre", "es_sistema"]

    def get_usuarios_count(self, obj):
        return obj.usuarios.count()

    def validate(self, attrs):
        superior = attrs.get(
            "superior",
            getattr(self.instance, "superior", None),
        )
        if self.instance and superior is not None and superior.pk == self.instance.pk:
            raise serializers.ValidationError(
                {"superior": "Un nivel no puede ser su propio superior."}
            )
        # Detectar ciclos recorriendo la cadena de superiores.
        visitados = set()
        actual = superior
        while actual is not None:
            if self.instance and actual.pk == self.instance.pk:
                raise serializers.ValidationError(
                    {
                        "superior": (
                            "La relación de aprobación no puede contener ciclos."
                        )
                    }
                )
            if actual.pk in visitados:
                break
            visitados.add(actual.pk)
            actual = actual.superior
        return attrs

class DisponibilidadUsuarioSerializer(serializers.ModelSerializer):
    class Meta:
        model = DisponibilidadUsuario
        fields = [
            "estado",
            "fecha_inicio",
            "fecha_fin",
            "motivo",
            "fecha_actualizacion",
        ]
        read_only_fields = ["fecha_actualizacion"]

    def validate(self, attrs):
        estado = attrs.get(
            "estado",
            getattr(self.instance, "estado", DisponibilidadUsuario.Estado.DISPONIBLE),
        )
        motivo = (
            attrs.get(
                "motivo",
                getattr(self.instance, "motivo", ""),
            )
            or ""
        ).strip()
        inicio = attrs.get(
            "fecha_inicio",
            getattr(self.instance, "fecha_inicio", None),
        )
        fin = attrs.get(
            "fecha_fin",
            getattr(self.instance, "fecha_fin", None),
        )

        if estado == DisponibilidadUsuario.Estado.INDISPONIBLE and not motivo:
            raise serializers.ValidationError({
                "motivo": "El motivo es obligatorio al marcarse indisponible."
            })

        if inicio and fin and inicio > fin:
            raise serializers.ValidationError({
                "fecha_fin": "La fecha fin no puede ser anterior a la fecha inicio."
            })

        attrs["motivo"] = motivo
        if estado == DisponibilidadUsuario.Estado.DISPONIBLE:
            attrs["motivo"] = ""
            attrs["fecha_inicio"] = None
            attrs["fecha_fin"] = None

        return attrs

class UserSerializer(serializers.ModelSerializer):
    # compat: frontend aún usa activo, exponer alias
    activo = serializers.BooleanField(source="is_active", read_only=True)
    nivel = serializers.SerializerMethodField()
    nivel_nombre = serializers.SerializerMethodField()
    puede_crear_solicitudes = serializers.SerializerMethodField()
    nivel_color = serializers.SerializerMethodField()
    bloqueo_estado_nivel = serializers.SerializerMethodField()
    

    class Meta:

        model = User

        fields = [
            "id",
            "codigo",
            "email",
            "nombres",
            "apellidos",
            "dni",
            "cargo",
            "descripcion_cargo",
            "telefono",
            "is_active",
            "activo",
            "tipo_usuario",
            "puede_crear_solicitudes",
            "nivel",
            "nivel_nombre",
            "nivel_color",
            "bloqueo_estado_nivel",
        ]

    def get_nivel(self, obj):
        from .jerarquia import nivel_efectivo

        nivel = nivel_efectivo(obj)
        return nivel.id if nivel else None

    def get_nivel_nombre(self, obj):
        from .jerarquia import nivel_efectivo

        nivel = nivel_efectivo(obj)
        return nivel.nombre if nivel else None

    def get_nivel_color(self, obj):
        from .jerarquia import nivel_efectivo

        nivel = nivel_efectivo(obj)
        return (nivel.color or None) if nivel else None

    def get_bloqueo_estado_nivel(self, obj):
        from .restricciones import motivo_bloqueo_estado_nivel

        equipo = None
        if hasattr(obj, "_es_miembro") or hasattr(obj, "_es_lider"):
            equipo = bool(
                getattr(obj, "_es_miembro", False)
                or getattr(obj, "_es_lider", False)
            )

        return motivo_bloqueo_estado_nivel(
            obj,
            pendientes=getattr(obj, "_tiene_pendientes", None),
            equipo=equipo,
            proceso=getattr(obj, "_tiene_solicitudes_proceso", None),
        )

    def get_puede_crear_solicitudes(self, obj):
        from .jerarquia import nivel_efectivo

        nivel = nivel_efectivo(obj)

        return bool(
            nivel
            and not nivel.es_sistema
            and nivel.puede_crear_solicitudes
        )

class UsuarioCandidatoSerializer(serializers.ModelSerializer):
    """Datos mínimos de un usuario candidato a integrar un equipo."""

    activo = serializers.BooleanField(source="is_active", read_only=True)
    nivel = serializers.SerializerMethodField()
    nivel_nombre = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "codigo",
            "email",
            "nombres",
            "apellidos",
            "tipo_usuario",
            "nivel",
            "nivel_nombre",
            "is_active",
            "activo",
        ]

    def get_nivel(self, obj):
        from .jerarquia import nivel_efectivo

        nivel = nivel_efectivo(obj)
        return nivel.id if nivel else None

    def get_nivel_nombre(self, obj):
        from .jerarquia import nivel_efectivo

        nivel = nivel_efectivo(obj)
        return nivel.nombre if nivel else None

class UserCreateSerializer(serializers.ModelSerializer):
    nivel = serializers.PrimaryKeyRelatedField(
        queryset=Nivel.objects.filter(es_sistema=False),
        write_only=True,
        required=False,
        allow_null=True,
    )
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)
    equipo_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    permisos_campana = serializers.ListField(child=serializers.DictField(), write_only=True, required=False)
    # alias compat para frontend que envía activo
    activo = serializers.BooleanField(write_only=True, required=False)

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "nombres",
            "apellidos",
            "dni",
            "cargo",
            "descripcion_cargo",
            "telefono",
            "is_active",
            "activo",
            "tipo_usuario",
            "password",
            "nivel",
            "equipo_id",
            "permisos_campana",
        ]
        read_only_fields = ["id"]

    def validate(self, attrs):
        from .models import TipoUsuario

        tipo = attrs.get(
            "tipo_usuario",
            getattr(self.instance, "tipo_usuario", TipoUsuario.COLABORADOR),
        )
        if tipo not in (
            TipoUsuario.COLABORADOR,
            TipoUsuario.ADMINISTRADOR,
        ):
            raise serializers.ValidationError(
                {"tipo_usuario": "Tipo de usuario inválido."}
            )

        if tipo == TipoUsuario.COLABORADOR:
            nivel = attrs.get("nivel")
            if self.instance is None and nivel is None:
                raise serializers.ValidationError(
                    {"nivel": "Selecciona un nivel para el colaborador."}
                )
            if self.instance is not None and nivel is None:
                from .jerarquia import nivel_efectivo

                actual = nivel_efectivo(self.instance)
                if actual is None or actual.es_sistema:
                    raise serializers.ValidationError(
                        {"nivel": "Selecciona un nivel para el colaborador."}
                    )

        # Solo aplica en actualización: restringe cambios de estado/nivel según
        # las reglas de negocio (subtareas pendientes, equipo, solicitudes).
        if self.instance is None:
            return attrs

        from .jerarquia import nivel_efectivo
        from .restricciones import motivo_bloqueo_estado_nivel

        cambia = False

        if "is_active" in attrs and attrs["is_active"] != self.instance.is_active:
            cambia = True
        if "activo" in attrs and attrs["activo"] != self.instance.is_active:
            cambia = True
        if (
            "tipo_usuario" in attrs
            and attrs["tipo_usuario"] != self.instance.tipo_usuario
        ):
            cambia = True
        if "nivel" in attrs:
            actual = nivel_efectivo(self.instance)
            nuevo = attrs["nivel"]
            if (actual.pk if actual else None) != (
                nuevo.pk if nuevo else None
            ):
                cambia = True

        if cambia:
            motivo = motivo_bloqueo_estado_nivel(self.instance)
            if motivo:
                raise serializers.ValidationError({"detail": motivo})

        return attrs

    def _nivel_sistema(self):
        return Nivel.objects.filter(es_sistema=True).first()

    def create(self, validated_data):
        from .models import TipoUsuario, UserNivel, Equipo, EquipoMiembro
        from campanas.models import PermisoCampana

        nivel = validated_data.pop("nivel", None)
        password = validated_data.pop("password", None)
        equipo_id = validated_data.pop("equipo_id", None)
        permisos = validated_data.pop("permisos_campana", [])
        tipo = validated_data.get("tipo_usuario") or TipoUsuario.COLABORADOR
        validated_data["tipo_usuario"] = tipo

        if tipo == TipoUsuario.ADMINISTRADOR:
            nivel = self._nivel_sistema()

        # compat activo -> is_active
        if "activo" in validated_data:
            activo_val = validated_data.pop("activo")
            if "is_active" not in validated_data:
                validated_data["is_active"] = activo_val
        if "is_active" not in validated_data:
            validated_data["is_active"] = True

        user = User(**validated_data)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save()

        UserNivel.objects.filter(usuario=user).delete()
        if nivel is not None:
            UserNivel.objects.create(usuario=user, nivel=nivel)

        if equipo_id and tipo == TipoUsuario.COLABORADOR:
            try:
                equipo = Equipo.objects.get(id=equipo_id)
                EquipoMiembro.objects.get_or_create(
                    equipo=equipo,
                    usuario=user,
                    defaults={
                        "rol_en_equipo": EquipoMiembro.RolEnEquipo.MIEMBRO,
                        "estado": EquipoMiembro.EstadoMiembro.ACTIVO,
                    },
                )
            except Equipo.DoesNotExist:
                pass

        for perm in permisos:
            subcampana_id = perm.get("subcampana_id") or perm.get("subcampana")
            try:
                if subcampana_id:
                    PermisoCampana.objects.get_or_create(
                        usuario=user,
                        subcampana_id=int(subcampana_id),
                    )
            except Exception:
                continue
        return user

    def update(self, instance, validated_data):
        from .models import TipoUsuario, UserNivel
        from .jerarquia import nivel_efectivo

        nivel = validated_data.pop("nivel", None)
        tipo = validated_data.get("tipo_usuario", instance.tipo_usuario)

        if tipo == TipoUsuario.ADMINISTRADOR:
            if nivel is None:
                nivel = self._nivel_sistema()
        elif tipo == TipoUsuario.COLABORADOR and nivel is None:
            actual = nivel_efectivo(instance)
            if actual is not None and actual.es_sistema:
                raise serializers.ValidationError(
                    {"nivel": "Selecciona un nivel para el colaborador."}
                )

        user = super().update(instance, validated_data)

        if nivel is not None:
            UserNivel.objects.filter(usuario=user).delete()
            UserNivel.objects.create(usuario=user, nivel=nivel)

        return user

class UserMeSerializer(serializers.ModelSerializer):
    """Datos del usuario autenticado usados por la sesión y el perfil."""

    nivel = serializers.SerializerMethodField()
    nivel_nombre = serializers.SerializerMethodField()

    puede_crear_solicitudes = serializers.SerializerMethodField()

    nivel_color = serializers.SerializerMethodField()

    puede_liderar = serializers.SerializerMethodField()

    es_aprobador = serializers.SerializerMethodField()

    class Meta:

        model = User

        fields = [
            "id",
            "codigo",
            "email",
            "nombres",
            "apellidos",
            "cargo",
            "tipo_usuario",
            "puede_crear_solicitudes",
            "nivel",
            "nivel_nombre",
            "nivel_color",
            "puede_liderar",
            "es_aprobador",
        ]

    def get_nivel(self, obj):
        from .jerarquia import nivel_efectivo

        nivel = nivel_efectivo(obj)
        return nivel.id if nivel else None

    def get_nivel_nombre(self, obj):
        from .jerarquia import nivel_efectivo

        nivel = nivel_efectivo(obj)
        return nivel.nombre if nivel else None

    def get_nivel_color(self, obj):
        from .jerarquia import nivel_efectivo

        nivel = nivel_efectivo(obj)
        return (nivel.color or None) if nivel else None

    def get_puede_liderar(self, obj):
        from .jerarquia import puede_ser_lider

        return puede_ser_lider(obj)

    def get_es_aprobador(self, obj):
        from .permissions import es_aprobador_organizacional
        return es_aprobador_organizacional(obj)

    def get_puede_crear_solicitudes(self, obj):
        from .jerarquia import nivel_efectivo

        nivel = nivel_efectivo(obj)

        return bool(
            nivel
            and not nivel.es_sistema
            and nivel.puede_crear_solicitudes
        )

class PreferenciaNotificacionSerializer(serializers.ModelSerializer):

    class Meta:
        model = PreferenciaNotificacion
        fields = [
            "recibir_correos",
            "cliente_solicitud_creada",
            "cliente_solicitud_resuelta",
            "cliente_solicitud_standby",
            "cliente_solicitud_reanudada",
            "cliente_solicitud_solucionada",
            "equipo_nueva_solicitud",
            "equipo_pendiente_revision",
            "equipo_alerta_diaria",
            "fecha_actualizacion",
        ]
        read_only_fields = ["fecha_actualizacion"]

class EquipoMiembroDetailSerializer(serializers.ModelSerializer):
    # Campos planos usados por las pantallas de equipos y asignación.
    id_usuario = serializers.IntegerField(source="usuario.id", read_only=True)
    email = serializers.CharField(source="usuario.email", read_only=True)
    nombres = serializers.CharField(source="usuario.nombres", read_only=True)
    apellidos = serializers.CharField(source="usuario.apellidos", read_only=True)
    cargo = serializers.CharField(source="usuario.cargo", read_only=True)
    disponibilidad = serializers.SerializerMethodField()

    class Meta:
        model = EquipoMiembro
        fields = [
            "id",
            "id_usuario",
            "email",
            "nombres",
            "apellidos",
            "cargo",
            "rol_en_equipo",
            "estado",
            "disponibilidad",
        ]

    def get_disponibilidad(self, obj):
        try:
            disponibilidad = obj.usuario.disponibilidad
        except DisponibilidadUsuario.DoesNotExist:
            return None
        return DisponibilidadUsuarioSerializer(disponibilidad).data

class EquipoMiembroClienteSerializer(serializers.ModelSerializer):
    usuario = serializers.SerializerMethodField()

    class Meta:
        model = EquipoMiembro
        fields = [
            "id",
            "usuario",
            "rol_en_equipo",
            "estado",
        ]

    def get_usuario(self, obj):
        return {
            "nombres": obj.usuario.nombres,
            "apellidos": obj.usuario.apellidos,
        }

class EquipoLiderSerializer(serializers.ModelSerializer):
    """Datos mínimos del líder mostrados en las pantallas de equipos."""

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "nombres",
            "apellidos",
            "cargo",
        ]

class EquipoDetailSerializer(serializers.ModelSerializer):

    lider = serializers.SerializerMethodField()

    miembros = serializers.SerializerMethodField()

    miembros_count = serializers.SerializerMethodField()

    puedo_gestionar = serializers.SerializerMethodField()

    mi_rol_en_equipo = serializers.SerializerMethodField()

    mi_estado = serializers.SerializerMethodField()

    niveles_integrantes_requeridos = serializers.SerializerMethodField()

    nivel = serializers.PrimaryKeyRelatedField(read_only=True)

    nivel_nombre = serializers.SerializerMethodField()

    nivel_color = serializers.SerializerMethodField()

    class Meta:
        model = Equipo
        fields = [
            "id",
            "nombre",
            "lider",
            "nivel",
            "nivel_nombre",
            "nivel_color",
            "niveles_integrantes_requeridos",
            "activo",
            "fecha_creacion",
            "miembros",
            "miembros_count",
            "puedo_gestionar",
            "mi_rol_en_equipo",
            "mi_estado",
        ]

    def validate_nombre(self, value):
        nombre = (value or "").strip()

        if not nombre:
            raise serializers.ValidationError(
                "El nombre del equipo es obligatorio."
            )

        existentes = Equipo.objects.filter(nombre__iexact=nombre)
        if self.instance is not None:
            existentes = existentes.exclude(pk=self.instance.pk)

        if existentes.exists():
            raise serializers.ValidationError(
                f"Ya existe un equipo con el nombre '{nombre}'."
            )

        return nombre

    def get_lider(self, obj):
        if obj.lider:
            return EquipoLiderSerializer(
                obj.lider,
                context=self.context,
            ).data

        return None


    def get_miembros(self, obj):
        request = self.context.get("request")
        qs = obj.miembros.select_related("usuario", "usuario__disponibilidad").all()
        user = getattr(request, "user", None) if request else None

        if user and not user.is_authenticated:
            qs = qs.filter(estado=EquipoMiembro.EstadoMiembro.ACTIVO)
        elif user:
            from .permissions import puede_gestionar_miembros
            # Si no puede gestionar y no es miembro activo del equipo,
            # ocultar los inactivos.
            try:
                if not puede_gestionar_miembros(user, obj):
                    is_member = qs.filter(usuario=user).exists() or obj.lider_id == user.id
                    if not is_member:
                        qs = qs.filter(estado=EquipoMiembro.EstadoMiembro.ACTIVO)
                    else:
                        qs = qs.exclude(estado=EquipoMiembro.EstadoMiembro.INACTIVO)
            except Exception:
                pass
        return EquipoMiembroDetailSerializer(
            qs,
            many=True,
            context=self.context,
        ).data

    def get_miembros_count(self, obj):
        """Cantidad de miembros activos, visible incluso para clientes."""
        return obj.miembros.filter(
            estado=EquipoMiembro.EstadoMiembro.ACTIVO,
        ).count()

    def get_puedo_gestionar(self, obj):
        request = self.context.get("request")
        if not request or not request.user or not request.user.is_authenticated:
            return False
        from .permissions import puede_gestionar_miembros
        return puede_gestionar_miembros(request.user, obj)

    def get_mi_rol_en_equipo(self, obj):
        request = self.context.get("request")
        if not request or not request.user or not request.user.is_authenticated:
            return None
        if obj.lider_id == request.user.id:
            return "LIDER"
        try:
            m = obj.miembros.get(usuario=request.user)
            return m.rol_en_equipo
        except EquipoMiembro.DoesNotExist:
            return None

    def get_mi_estado(self, obj):
        request = self.context.get("request")
        if not request or not request.user or not request.user.is_authenticated:
            return None
        try:
            m = obj.miembros.get(usuario=request.user)
            return m.estado
        except EquipoMiembro.DoesNotExist:
            if obj.lider_id == request.user.id:
                return EquipoMiembro.EstadoMiembro.ACTIVO
            return None

    def get_niveles_integrantes_requeridos(self, obj):
        from .jerarquia import niveles_integrantes_requeridos

        return [n.nombre for n in niveles_integrantes_requeridos(obj)]

    def get_nivel_nombre(self, obj):
        nivel = getattr(obj, "nivel", None)
        return nivel.nombre if nivel is not None else None

    def get_nivel_color(self, obj):
        nivel = getattr(obj, "nivel", None)
        color = getattr(nivel, "color", "") if nivel is not None else ""
        return color or None

class EquipoCreateSerializer(serializers.ModelSerializer):
    lider = serializers.CharField(write_only=True)

    class Meta:
        model = Equipo
        fields = ["id", "nombre", "lider", "activo", "fecha_creacion"]
        read_only_fields = ["id", "activo", "fecha_creacion"]

    def validate_nombre(self, value):
        nombre = value.strip()

        if not nombre:
            raise serializers.ValidationError(
                "El nombre del equipo es obligatorio."
            )

        if Equipo.objects.filter(nombre__iexact=nombre).exists():
            raise serializers.ValidationError(
                f"Ya existe un equipo con el nombre '{nombre}'."
            )

        return nombre

    def validate_lider(self, value):
        codigo = value.strip().upper()

        try:
            usuario = User.objects.get(codigo__iexact=codigo)
        except User.DoesNotExist:
            raise serializers.ValidationError(
                f"Usuario con código '{codigo}' no encontrado."
            )

        if not usuario.is_active:
            raise serializers.ValidationError(
                "No se puede asignar como líder a un usuario inactivo."
            )

        from .jerarquia import puede_ser_lider
        if not puede_ser_lider(usuario):
            raise serializers.ValidationError(
                "El líder debe ser un usuario colaborador con un nivel que "
                "tenga el permiso de <Puede liderar equipos>."
            )

        return usuario

    def create(self, validated_data):
        usuario_lider = validated_data.pop("lider")

        equipo = Equipo.objects.create(
            nombre=validated_data["nombre"],
            lider=usuario_lider,
        )

        return equipo

class PreferenciaNotificacionSerializer(serializers.ModelSerializer):
    class Meta:
        model = PreferenciaNotificacion

        fields = (
            "recibir_correos",
            "cliente_solicitud_creada",
            "cliente_solicitud_resuelta",
            "cliente_solicitud_standby",
            "cliente_solicitud_reanudada",
            "cliente_solicitud_solucionada",
            "equipo_nueva_solicitud",
            "equipo_pendiente_revision",
            "equipo_alerta_diaria",
            "equipo_hora_alerta_diaria",
            "fecha_actualizacion",
        )

        read_only_fields = (
            "fecha_actualizacion",
        )

    def validate(self, attrs):
        recibir_correos = attrs.get(
            "recibir_correos",
            getattr(self.instance, "recibir_correos", True),
        )

        equipo_alerta_diaria = attrs.get(
            "equipo_alerta_diaria",
            getattr(self.instance, "equipo_alerta_diaria", True),
        )

        hora_alerta = attrs.get(
            "equipo_hora_alerta_diaria",
            getattr(
                self.instance,
                "equipo_hora_alerta_diaria",
                None,
            ),
        )

        if recibir_correos and equipo_alerta_diaria and hora_alerta is None:
            raise serializers.ValidationError(
                {
                    "equipo_hora_alerta_diaria": (
                        "Debes indicar una hora para la alerta diaria."
                    )
                }
            )

        return attrs