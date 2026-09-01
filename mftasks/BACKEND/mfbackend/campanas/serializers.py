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

    def validate(self, attrs):
        campana = attrs.get("campana")
        subcampana = attrs.get("subcampana")
        from usuarios.models import User
        usuario = attrs.get("usuario")
        # Si usuario es CLIENTE, solo permitir permiso puntual a subcampana
        if usuario:
            try:
                u = usuario if isinstance(usuario, User) else User.objects.get(id=int(usuario))
                if u.roles.filter(rol__nombre__iexact="CLIENTE").exists():
                    if campana and not subcampana:
                        raise serializers.ValidationError({"campana": "Clientes solo pueden tener permiso puntual a subcampaña, no a campaña completa."})
                    if not subcampana:
                        raise serializers.ValidationError({"subcampana": "Para clientes debe indicar subcampaña."})
            except Exception as e:
                # si es ValidationError ya lanzado, re-lanzar
                if isinstance(e, serializers.ValidationError):
                    raise
                pass
        # XOR ya validado por modelo, pero mensaje claro
        if (campana is None) == (subcampana is None):
            raise serializers.ValidationError("Debe indicar campana o subcampana, no ambos ni ninguno. Para clientes use subcampana.")
        return attrs
