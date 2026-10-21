from rest_framework import serializers
import re
import unicodedata

from .models import Campana, SubCampana, PermisoCampana


def _norm_nombre(valor):
    """Normaliza un nombre: sin acentos, espacios colapsados y casefold."""
    valor = unicodedata.normalize("NFKD", valor or "")
    valor = "".join(c for c in valor if not unicodedata.combining(c))
    valor = re.sub(r"\s+", " ", valor).strip().casefold()
    return valor


def _existe_nombre(qs, nombre, exclude_pk=None):
    objetivo = _norm_nombre(nombre)
    if not objetivo:
        return False
    if exclude_pk is not None:
        qs = qs.exclude(pk=exclude_pk)
    for existente in qs.only("id", "nombre"):
        if _norm_nombre(existente.nombre) == objetivo:
            return True
    return False


class SubCampanaSerializer(serializers.ModelSerializer):
    campana_nombre = serializers.CharField(source="campana.nombre", read_only=True)
    entidad = serializers.IntegerField(source="campana.entidad_id", read_only=True)
    entidad_nombre = serializers.CharField(source="campana.entidad.nombre", read_only=True)

    class Meta:
        model = SubCampana
        fields = [
            "id",
            "entidad",
            "entidad_nombre",
            "campana",
            "campana_nombre",
            "nombre",
            "codigo",
            "activo",
            "fecha_creacion",
        ]
        read_only_fields = ["codigo"]

    def validate(self, attrs):
        attrs = super().validate(attrs)
        nombre = attrs.get("nombre", getattr(self.instance, "nombre", ""))
        campana = attrs.get("campana", getattr(self.instance, "campana", None))
        if campana and nombre:
            qs = SubCampana.objects.filter(campana=campana)
            exclude_pk = self.instance.pk if self.instance is not None else None
            if _existe_nombre(qs, nombre, exclude_pk):
                raise serializers.ValidationError({
                    "nombre": "Ya existe una subcampaña con ese nombre en esta campaña."
                })
        return attrs


class CampanaSerializer(serializers.ModelSerializer):
    entidad_nombre = serializers.CharField(source="entidad.nombre", read_only=True)
    subcampanas = SubCampanaSerializer(many=True, read_only=True)

    class Meta:
        model = Campana
        fields = [
            "id",
            "entidad",
            "entidad_nombre",
            "nombre",
            "codigo",
            "activo",
            "fecha_creacion",
            "subcampanas",
        ]
        read_only_fields = ["codigo"]

    def validate(self, attrs):
        attrs = super().validate(attrs)
        entidad = attrs.get("entidad", getattr(self.instance, "entidad", None))
        nombre = attrs.get("nombre", getattr(self.instance, "nombre", ""))
        if entidad and nombre:
            qs = Campana.objects.filter(entidad=entidad)
            exclude_pk = self.instance.pk if self.instance is not None else None
            if _existe_nombre(qs, nombre, exclude_pk):
                raise serializers.ValidationError({
                    "nombre": "Ya existe una campaña con ese nombre en la entidad."
                })
        return attrs


class PermisoCampanaSerializer(serializers.ModelSerializer):
    usuario_email = serializers.CharField(source="usuario.email", read_only=True)
    campana_nombre = serializers.CharField(source="campana.nombre", read_only=True)
    subcampana_nombre = serializers.CharField(source="subcampana.nombre", read_only=True)
    entidad_nombre = serializers.SerializerMethodField()

    class Meta:
        model = PermisoCampana
        fields = ["id", "usuario", "usuario_email", "entidad_nombre", "campana", "campana_nombre", "subcampana", "subcampana_nombre", "fecha_otorgado"]

    def get_entidad_nombre(self, obj):
        if obj.subcampana_id and obj.subcampana:
            return obj.subcampana.campana.entidad.nombre
        if obj.campana_id and obj.campana:
            return obj.campana.entidad.nombre
        return None

    def validate(self, attrs):
        campana = attrs.get("campana")
        subcampana = attrs.get("subcampana")
        from usuarios.models import User
        usuario = attrs.get("usuario")
        # Bloquear permisos a entidades inhabilitadas
        if campana is not None and not campana.activo:
            raise serializers.ValidationError({"campana": "La campaña está inhabilitada por Administración."})
        if subcampana is not None:
            if not subcampana.activo or not subcampana.campana.activo:
                raise serializers.ValidationError({"subcampana": "La campaña/subcampaña está inhabilitada por Administración."})
        # Si usuario es CLIENTE, solo permitir permiso puntual a subcampana
        if usuario:
            try:
                from usuarios.permissions import es_cliente
                u = usuario if isinstance(usuario, User) else User.objects.get(id=int(usuario))
                if es_cliente(u):
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
