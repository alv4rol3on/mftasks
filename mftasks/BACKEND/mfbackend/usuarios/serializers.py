from rest_framework import serializers
from .models import *

class RolSerializer(serializers.ModelSerializer):

    class Meta:
        model = Rol
        fields = "__all__"

class UserSerializer(serializers.ModelSerializer):

    class Meta:

        model = User

        fields = [
            "id",
            "email",
            "nombres",
            "apellidos",
            "cargo",
            "activo",
            "is_active",
        ]


class UserCreateSerializer(serializers.ModelSerializer):
    roles = serializers.ListField(child=serializers.CharField(), write_only=True, required=False)
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)
    equipo_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    permisos_campana = serializers.ListField(child=serializers.DictField(), write_only=True, required=False)

    class Meta:
        model = User
        fields = ["id", "email", "nombres", "apellidos", "cargo", "activo", "password", "roles", "equipo_id", "permisos_campana"]
        read_only_fields = ["id"]

    def validate_roles(self, value):
        allowed = {"administrador", "miembro", "cliente"}
        # lider no es global, se asigna por equipo
        normalized = [v.lower().strip() for v in value]
        for r in normalized:
            if r not in allowed:
                raise serializers.ValidationError(f"Rol '{r}' no permitido. Use: {allowed}")
        return normalized

    def create(self, validated_data):
        roles = validated_data.pop("roles", [])
        password = validated_data.pop("password", None)
        equipo_id = validated_data.pop("equipo_id", None)
        permisos = validated_data.pop("permisos_campana", [])
        activo = validated_data.get("activo", True)
        validated_data["is_active"] = activo
        user = User(**validated_data)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save()
        from .models import Rol, UserRol, Equipo, EquipoMiembro
        from campanas.models import PermisoCampana
        for rname in roles:
            rol_obj, _ = Rol.objects.get_or_create(nombre__iexact=rname, defaults={"nombre": rname.capitalize()})
            # fallback si iexact no encontró por case
            if rol_obj.nombre.lower() != rname.lower():
                try:
                    rol_obj = Rol.objects.get(nombre__iexact=rname)
                except Rol.DoesNotExist:
                    rol_obj = Rol.objects.create(nombre=rname.capitalize())
            UserRol.objects.get_or_create(usuario=user, rol=rol_obj)
        if equipo_id:
            try:
                equipo = Equipo.objects.get(id=equipo_id)
                EquipoMiembro.objects.get_or_create(equipo=equipo, usuario=user, defaults={"rol_en_equipo": EquipoMiembro.RolEnEquipo.MIEMBRO, "estado": EquipoMiembro.EstadoMiembro.ACTIVO})
            except Equipo.DoesNotExist:
                pass
        for perm in permisos:
            campana_id = perm.get("campana_id") or perm.get("campana")
            subcampana_id = perm.get("subcampana_id") or perm.get("subcampana")
            try:
                if subcampana_id:
                    PermisoCampana.objects.get_or_create(usuario=user, subcampana_id=int(subcampana_id))
                elif campana_id:
                    PermisoCampana.objects.get_or_create(usuario=user, campana_id=int(campana_id))
            except Exception:
                continue
        return user

class UserDetailSerializer(serializers.ModelSerializer):

    roles = serializers.SerializerMethodField()

    class Meta:

        model = User

        fields = [
            "id",
            "email",
            "nombres",
            "apellidos",
            "cargo",
            "roles"
        ]

    def get_roles(self, obj):

        return [
            r.rol.nombre
            for r in obj.roles.all()
        ]

class EquipoMiembroDetailSerializer(serializers.ModelSerializer):

    usuario = UserSerializer(read_only=True)

    # campos planos para facilitar consumo en frontend
    id_usuario = serializers.IntegerField(source="usuario.id", read_only=True)
    email = serializers.CharField(source="usuario.email", read_only=True)
    nombres = serializers.CharField(source="usuario.nombres", read_only=True)
    apellidos = serializers.CharField(source="usuario.apellidos", read_only=True)
    cargo = serializers.CharField(source="usuario.cargo", read_only=True)

    class Meta:
        model = EquipoMiembro
        fields = [
            "id",
            "usuario",
            "id_usuario",
            "email",
            "nombres",
            "apellidos",
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

    class Meta:
        model = Equipo
        fields = [
            "id",
            "nombre",
            "lider",
            "activo",
            "fecha_creacion",
            "miembros",
            "puedo_gestionar",
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