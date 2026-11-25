from django.db import IntegrityError, transaction
from django.utils import timezone

from .models import Campana, SubCampana


def _campos_eliminacion():
    return ["eliminado", "activo", "fecha_eliminacion", "eliminado_por"]


def eliminar_subcampana(subcampana, usuario=None):
    ahora = timezone.now()
    subcampana.eliminado = True
    subcampana.activo = False
    subcampana.fecha_eliminacion = ahora
    subcampana.eliminado_por = usuario
    subcampana.save(update_fields=_campos_eliminacion())
    return {"eliminados": 1, "detalle": "Subcampaña eliminada."}


def eliminar_campana(campana, usuario=None):
    ahora = timezone.now()
    with transaction.atomic():
        subcampanas = SubCampana.objects.filter(
            campana=campana,
            eliminado=False,
        ).update(
            eliminado=True,
            activo=False,
            fecha_eliminacion=ahora,
            eliminado_por=usuario,
        )
        campana.eliminado = True
        campana.activo = False
        campana.fecha_eliminacion = ahora
        campana.eliminado_por = usuario
        campana.save(update_fields=_campos_eliminacion())
    return {
        "eliminados": 1 + subcampanas,
        "subcampanas": subcampanas,
        "detalle": "Campaña y sus subcampañas fueron eliminadas.",
    }


def eliminar_entidad(entidad, usuario=None):
    ahora = timezone.now()
    with transaction.atomic():
        subcampanas = SubCampana.objects.filter(
            campana__entidad=entidad,
            eliminado=False,
        ).update(
            eliminado=True,
            activo=False,
            fecha_eliminacion=ahora,
            eliminado_por=usuario,
        )
        campanas = Campana.objects.filter(
            entidad=entidad,
            eliminado=False,
        ).update(
            eliminado=True,
            activo=False,
            fecha_eliminacion=ahora,
            eliminado_por=usuario,
        )
        entidad.eliminado = True
        entidad.activo = False
        entidad.fecha_eliminacion = ahora
        entidad.eliminado_por = usuario
        entidad.save(update_fields=_campos_eliminacion())
    return {
        "eliminados": 1 + campanas + subcampanas,
        "campanas": campanas,
        "subcampanas": subcampanas,
        "detalle": "Entidad, campañas y subcampañas fueron eliminadas.",
    }


def _restaurar_instancia(instancia):
    try:
        with transaction.atomic():
            instancia.eliminado = False
            instancia.fecha_eliminacion = None
            instancia.eliminado_por = None
            instancia.activo = False
            instancia.save(
                update_fields=[
                    "eliminado",
                    "fecha_eliminacion",
                    "eliminado_por",
                    "activo",
                ]
            )
        return True
    except IntegrityError:
        return False


def restaurar_subcampana(subcampana):
    if subcampana.campana.eliminado:
        return {
            "restaurados": 0,
            "omitidos": 1,
            "detalle": "Restaura primero la campaña padre.",
        }
    if not _restaurar_instancia(subcampana):
        return {
            "restaurados": 0,
            "omitidos": 1,
            "detalle": "No se pudo restaurar: el nombre o código ya está en uso.",
        }
    return {
        "restaurados": 1,
        "omitidos": 0,
        "detalle": "Subcampaña restaurada. Queda inhabilitada hasta que la habilites.",
    }


def restaurar_campana(campana):
    if campana.entidad.eliminado:
        return {
            "restaurados": 0,
            "omitidos": 1,
            "detalle": "Restaura primero la entidad padre.",
        }

    if not _restaurar_instancia(campana):
        return {
            "restaurados": 0,
            "omitidos": 1,
            "detalle": "No se pudo restaurar: el nombre o código ya está en uso.",
        }

    restaurados = 1
    omitidos = 0
    for subcampana in SubCampana.objects.filter(campana=campana, eliminado=True):
        if _restaurar_instancia(subcampana):
            restaurados += 1
        else:
            omitidos += 1

    detalle = "Campaña restaurada. Queda inhabilitada hasta que la habilites."
    if omitidos:
        detalle += f" {omitidos} subcampaña(s) no se pudieron restaurar por duplicados."
    elif restaurados > 1:
        detalle += f" Se restauraron {restaurados - 1} subcampaña(s)."
    return {"restaurados": restaurados, "omitidos": omitidos, "detalle": detalle}


def restaurar_entidad(entidad):
    if not _restaurar_instancia(entidad):
        return {
            "restaurados": 0,
            "omitidos": 1,
            "detalle": "No se pudo restaurar: el nombre ya está en uso.",
        }

    restaurados = 1
    omitidos = 0
    for campana in Campana.objects.filter(entidad=entidad, eliminado=True).order_by(
        "id"
    ):
        if not _restaurar_instancia(campana):
            omitidos += 1
            continue
        restaurados += 1
        for subcampana in SubCampana.objects.filter(
            campana=campana,
            eliminado=True,
        ).order_by("id"):
            if _restaurar_instancia(subcampana):
                restaurados += 1
            else:
                omitidos += 1

    detalle = "Entidad restaurada. Queda inhabilitada hasta que la habilites."
    if omitidos:
        detalle += f" {omitidos} elemento(s) no se pudieron restaurar por duplicados."
    return {"restaurados": restaurados, "omitidos": omitidos, "detalle": detalle}
