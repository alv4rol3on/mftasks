from django.db.models import Q
from django.utils import timezone


def filtro_no_disponible(prefix="usuario", fecha=None):
    """Q que identifica usuarios con indisponibilidad vigente."""
    fecha = fecha or timezone.localdate()
    return (
        Q(**{f"{prefix}__disponibilidad__estado": "INDISPONIBLE"})
        & (
            Q(**{f"{prefix}__disponibilidad__fecha_inicio__isnull": True})
            | Q(**{f"{prefix}__disponibilidad__fecha_inicio__lte": fecha})
        )
        & (
            Q(**{f"{prefix}__disponibilidad__fecha_fin__isnull": True})
            | Q(**{f"{prefix}__disponibilidad__fecha_fin__gte": fecha})
        )
    )


def excluir_no_disponibles(queryset, prefix="usuario", fecha=None):
    return queryset.exclude(filtro_no_disponible(prefix, fecha))


def esta_disponible(usuario, fecha=None):
    if usuario is None:
        return False

    try:
        disponibilidad = usuario.disponibilidad
    except Exception:
        return True

    return disponibilidad.esta_disponible(fecha)
