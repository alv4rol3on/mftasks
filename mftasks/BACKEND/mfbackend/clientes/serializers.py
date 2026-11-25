from rest_framework import serializers

from .models import Entidad


class EntidadSerializer(serializers.ModelSerializer):
    class Meta:
        model = Entidad
        fields = [
            "id",
            "nombre",
            "razon_social",
            "ruc",
            "correo",
            "telefono",
            "direccion",
            "activo",
            "eliminado",
            "fecha_eliminacion",
            "eliminado_por",
            "fecha_creacion",
        ]
        read_only_fields = ["eliminado", "fecha_eliminacion", "eliminado_por"]

    def validate_nombre(self, value):
        nombre = (value or "").strip()
        if not nombre:
            raise serializers.ValidationError("El nombre es obligatorio.")
        qs = Entidad.objects.filter(nombre__iexact=nombre, eliminado=False)
        if self.instance is not None:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError(
                "Ya existe una entidad activa con ese nombre."
            )
        return nombre
