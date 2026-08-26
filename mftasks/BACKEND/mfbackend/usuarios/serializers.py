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
            "activo"
        ]

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
        if obj.lider_id == request.user.id:
            return EquipoMiembro.EstadoMiembro.ACTIVO
        try:
            m = obj.miembros.get(usuario=request.user)
            return m.estado
        except EquipoMiembro.DoesNotExist:
            return None