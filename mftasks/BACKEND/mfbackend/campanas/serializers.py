from rest_framework import serializers
from .models import Campana, SubCampana, PermisoCampana


class SubCampanaSerializer(serializers.ModelSerializer):
    campana_nombre = serializers.CharField(source="campana.nombre", read_only=True)

    class Meta:
        model = SubCampana
        fields = ["id", "campana", "campana_nombre", "nombre", "codigo", "activo", "fecha_creacion"]
        read_only_fields = ["codigo"]


class CampanaSerializer(serializers.ModelSerializer):
    subcampanas = SubCampanaSerializer(many=True, read_only=True)

    class Meta:
        model = Campana
        fields = ["id", "nombre", "codigo", "ruc", "razon_social", "correo", "telefono", "direccion", "activo", "fecha_creacion", "subcampanas"]
        read_only_fields = ["codigo"]


class PermisoCampanaSerializer(serializers.ModelSerializer):
    usuario_email = serializers.CharField(source="usuario.email", read_only=True)
    campana_nombre = serializers.CharField(source="campana.nombre", read_only=True)
    subcampana_nombre = serializers.CharField(source="subcampana.nombre", read_only=True)

    class Meta:
        model = PermisoCampana
        fields = ["id", "usuario", "usuario_email", "campana", "campana_nombre", "subcampana", "subcampana_nombre", "fecha_otorgado"]
