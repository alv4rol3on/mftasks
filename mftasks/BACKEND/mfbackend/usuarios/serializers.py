from rest_framework import serializers
from .models import *

class RolSerializer(serializers.ModelSerializer):

    class Meta:
        model = Rol
        fields = "__all__"

    def validate(self, attrs):
        nombre = attrs.get("nombre", getattr(self.instance, "nombre", None))
        if nombre:
            existentes = Rol.objects.filter(nombre__iexact=nombre.strip())
            if self.instance:
                existentes = existentes.exclude(pk=self.instance.pk)
            if existentes.exists():
                raise serializers.ValidationError(
                    {"nombre": "Ya existe un rol con ese nombre."}
                )

        superior = attrs.get(
            "superior",
            getattr(self.instance, "superior", None),
        )
        if self.instance and superior is not None and superior.pk == self.instance.pk:
            raise serializers.ValidationError(
                {"superior": "Un rol no puede ser su propio superior."}
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

class UserSerializer(serializers.ModelSerializer):
    # compat: frontend aún usa activo, exponer alias
    activo = serializers.BooleanField(source="is_active", read_only=True)
    roles = serializers.SerializerMethodField()

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
            "is_active",
            "activo",
            "tipo_usuario",
            "roles",
        ]

    def get_roles(self, obj):
        return [r.rol.nombre for r in obj.roles.all()]

class UserCreateSerializer(serializers.ModelSerializer):
    roles = serializers.ListField(child=serializers.CharField(), write_only=True, required=False)
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)
    equipo_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    permisos_campana = serializers.ListField(child=serializers.DictField(), write_only=True, required=False)
    # alias compat para frontend que envía activo
    activo = serializers.BooleanField(write_only=True, required=False)

    class Meta:
        model = User
        fields = ["id", "email", "nombres", "apellidos", "dni","cargo", "is_active", "activo", "tipo_usuario", "password", "roles", "equipo_id", "permisos_campana"]
        read_only_fields = ["id"]

    def validate_roles(self, value):
        """Valida que cada rol indicado exista (la lista es dinámica)."""
        from .models import Rol

        normalized = [v.strip() for v in value if v and v.strip()]
        inexistentes = []
        for rname in normalized:
            if not Rol.objects.filter(nombre__iexact=rname).exists():
                inexistentes.append(rname)
        if inexistentes:
            raise serializers.ValidationError(
                "Roles no encontrados: "
                + ", ".join(inexistentes)
                + ". Créelos primero desde la administración de roles."
            )
        return normalized

    def _tipo_usuario_para_roles(self, roles):
        from .models import TipoUsuario

        nombres = {r.lower() for r in roles}
        if "administrador" in nombres:
            return TipoUsuario.ADMINISTRADOR
        if "cliente" in nombres:
            return TipoUsuario.CLIENTE
        return TipoUsuario.COLABORADOR

    def create(self, validated_data):
        roles = validated_data.pop("roles", [])
        password = validated_data.pop("password", None)
        equipo_id = validated_data.pop("equipo_id", None)
        permisos = validated_data.pop("permisos_campana", [])
        # tipo_usuario derivado de los roles si no se indica explícitamente
        if not validated_data.get("tipo_usuario"):
            validated_data["tipo_usuario"] = self._tipo_usuario_para_roles(roles)
        # compat activo -> is_active
        if "activo" in validated_data:
            activo_val = validated_data.pop("activo")
            if "is_active" not in validated_data:
                validated_data["is_active"] = activo_val
        # is_active ya viene en validated_data si se envía, default True
        if "is_active" not in validated_data:
            validated_data["is_active"] = True
        user = User(**validated_data)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save()
        from .models import Rol, UserRol, Equipo, EquipoMiembro
        from campanas.models import PermisoCampana
        for rname in roles:
            rol_obj = Rol.objects.filter(nombre__iexact=rname).first()
            if rol_obj is None:
                # validate_roles ya garantiza existencia; salvaguarda defensiva.
                continue
            UserRol.objects.get_or_create(usuario=user, rol=rol_obj)
        # CLIENTE nunca pertenece a equipo aunque venga equipo_id
        es_cliente = any(r.lower() == "cliente" for r in roles)
        if equipo_id and not es_cliente:
            try:
                equipo = Equipo.objects.get(id=equipo_id)
                EquipoMiembro.objects.get_or_create(equipo=equipo, usuario=user, defaults={"rol_en_equipo": EquipoMiembro.RolEnEquipo.MIEMBRO, "estado": EquipoMiembro.EstadoMiembro.ACTIVO})
            except Equipo.DoesNotExist:
                pass
        for perm in permisos:
            subcampana_id = perm.get("subcampana_id") or perm.get("subcampana")
            # permiso puntual solo a subcampana; campana_id se ignora para CLIENTE (requisito)
            try:
                if subcampana_id:
                    PermisoCampana.objects.get_or_create(usuario=user, subcampana_id=int(subcampana_id))
            except Exception:
                continue
        return user

class UserDetailSerializer(serializers.ModelSerializer):

    roles = serializers.SerializerMethodField()

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
            "tipo_usuario",
            "roles"
        ]

    def get_roles(self, obj):

        return [
            r.rol.nombre
            for r in obj.roles.all()
        ]

class PreferenciaNotificacionSerializer(serializers.ModelSerializer):

    class Meta:
        model = PreferenciaNotificacion
        fields = [
            "recibir_correos",
            "cliente_solicitud_creada",
            "cliente_solicitud_resuelta",
            "cliente_solicitud_standby",
            "cliente_solicitud_solucionada",
            "equipo_nueva_solicitud",
            "equipo_pendiente_revision",
            "equipo_alerta_diaria",
            "fecha_actualizacion",
        ]
        read_only_fields = ["fecha_actualizacion"]

class EquipoMiembroDetailSerializer(serializers.ModelSerializer):
    usuario = UserSerializer(read_only=True)

    # campos planos para facilitar consumo en frontend
    id_usuario = serializers.IntegerField(source="usuario.id", read_only=True)
    codigo = serializers.CharField(source="usuario.codigo", read_only=True)
    email = serializers.CharField(source="usuario.email", read_only=True)
    nombres = serializers.CharField(source="usuario.nombres", read_only=True)
    apellidos = serializers.CharField(source="usuario.apellidos", read_only=True)
    dni = serializers.CharField(source="usuario.dni")
    cargo = serializers.CharField(source="usuario.cargo", read_only=True)

    class Meta:
        model = EquipoMiembro
        fields = [
            "id",
            "usuario",
            "id_usuario",
            "codigo",
            "email",
            "nombres",
            "apellidos",
            "dni",
            "cargo",
            "rol_en_equipo",
            "estado",
            "fecha_inicio_indisponibilidad",
            "fecha_fin_indisponibilidad",
            "motivo_indisponibilidad",
            "fecha_ingreso",
        ]

class EquipoDetailSerializer(serializers.ModelSerializer):

    lider = UserSerializer(read_only=True)

    miembros = serializers.SerializerMethodField()

    puedo_gestionar = serializers.SerializerMethodField()

    mi_rol_en_equipo = serializers.SerializerMethodField()

    mi_estado = serializers.SerializerMethodField()

    rol_integrante_requerido = serializers.SerializerMethodField()

    aprobadores = serializers.SerializerMethodField()

    puedo_asignar_aprobadores = serializers.SerializerMethodField()

    class Meta:
        model = Equipo
        fields = [
            "id",
            "nombre",
            "lider",
            "tipo_equipo",
            "rol_integrante_requerido",
            "activo",
            "fecha_creacion",
            "miembros",
            "aprobadores",
            "puedo_gestionar",
            "puedo_asignar_aprobadores",
            "mi_rol_en_equipo",
            "mi_estado",
        ]

    def get_miembros(self, obj):
        request = self.context.get("request")
        qs = obj.miembros.select_related("usuario").all()
        # Para cliente o usuario sin permiso de gestión, ocultar inactivos
        user = getattr(request, "user", None) if request else None
        if user and not user.is_authenticated:
            qs = qs.filter(estado=EquipoMiembro.EstadoMiembro.ACTIVO)
        elif user:
            from .permissions import puede_gestionar_miembros
            # si no puede gestionar y no es miembro activo del equipo, ocultar inactivos
            try:
                if not puede_gestionar_miembros(user, obj):
                    # miembros ven activos + indisponibles, no inactivos
                    # clientes ven solo activos
                    is_member = qs.filter(usuario=user).exists() or obj.lider_id == user.id
                    if not is_member:
                        # cliente: solo activos
                        qs = qs.filter(estado=EquipoMiembro.EstadoMiembro.ACTIVO)
                    else:
                        qs = qs.exclude(estado=EquipoMiembro.EstadoMiembro.INACTIVO)
            except Exception:
                pass
        return EquipoMiembroDetailSerializer(qs, many=True).data

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

    def get_rol_integrante_requerido(self, obj):
        from .jerarquia import rol_integrante_requerido
        return rol_integrante_requerido(obj)

    def get_aprobadores(self, obj):
        return [
            {
                "id": a.id,
                "usuario": UserSerializer(a.usuario).data,
                "rol_aprobador": a.rol_aprobador.nombre if a.rol_aprobador_id else None,
            }
            for a in obj.aprobadores.select_related("usuario", "rol_aprobador").all()
        ]

    def get_puedo_asignar_aprobadores(self, obj):
        request = self.context.get("request")
        if not request or not request.user or not request.user.is_authenticated:
            return False
        from .permissions import es_administrador
        return es_administrador(request.user)

class EquipoCreateSerializer(serializers.ModelSerializer):
    lider = serializers.CharField(write_only=True)

    class Meta:
        model = Equipo
        fields = ["id", "nombre", "lider", "tipo_equipo", "activo", "fecha_creacion"]
        read_only_fields = ["id", "tipo_equipo", "activo", "fecha_creacion"]

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
                "El usuario debe tener un rol de la jerarquía "
                "(GERENTE, SUBGERENTE, JEFE o GTR) para ser líder."
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
            "cliente_solicitud_solucionada",
            "cliente_resumen_diario",
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