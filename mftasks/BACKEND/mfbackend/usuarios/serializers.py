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

class EquipoDetailSerializer(serializers.ModelSerializer):

    lider = UserSerializer(read_only=True)

    miembros = serializers.SerializerMethodField()

    class Meta:
        model = Equipo
        fields = [
            "id",
            "nombre",
            "lider",
            "activo",
            "fecha_creacion",
            "miembros",
        ]

    def get_miembros(self, obj):

        return UserSerializer(
            [m.usuario for m in obj.miembros.all()],
            many=True,
        ).data