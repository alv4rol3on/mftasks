from django.db import transaction
from django.utils import timezone

from ..models import Tarea, TareaLog
from .logs import registrar_log
from .notificaciones import notificar_tarea


ESTADOS_CANCELABLES = frozenset({
    Tarea.Estado.EN_ESPERA,
    Tarea.Estado.APROBADO,
    Tarea.Estado.EN_DESARROLLO,
    Tarea.Estado.STAND_BY,
})


class CancelacionInvalida(Exception):
    pass


def cancelar_tarea(tarea, usuario, motivo, solo_antes_de_iniciar=False):
    motivo = (motivo or "").strip()
    if not motivo:
        raise CancelacionInvalida("El motivo de cancelación es obligatorio.")

    with transaction.atomic():
        actual = Tarea.objects.select_for_update().get(pk=tarea.pk)

        if not actual.activo:
            raise CancelacionInvalida("La solicitud ya está inactiva.")
        if actual.estado == Tarea.Estado.CANCELADO:
            raise CancelacionInvalida("La solicitud ya está cancelada.")
        if actual.estado not in ESTADOS_CANCELABLES:
            raise CancelacionInvalida(
                "Solo se pueden cancelar solicitudes abiertas."
            )
        if solo_antes_de_iniciar and actual.estado not in (
            Tarea.Estado.EN_ESPERA,
            Tarea.Estado.APROBADO,
        ):
            raise CancelacionInvalida(
                "Solo puedes cancelar la solicitud antes de que el equipo "
                "inicie el trabajo."
            )

        estado_anterior = actual.estado
        ahora = timezone.localtime(timezone.now())

        actual.estado = Tarea.Estado.CANCELADO
        actual.activo = False
        actual.fecha_inactivacion = ahora
        actual.inactivada_por = usuario
        actual.motivo_cancelacion = motivo
        actual.save(update_fields=[
            "estado",
            "activo",
            "fecha_inactivacion",
            "inactivada_por",
            "motivo_cancelacion",
        ])

        registrar_log(
            tarea=actual,
            usuario=usuario,
            tipo_evento=TareaLog.TipoEvento.CANCELACION,
            estado_anterior=estado_anterior,
            estado_nuevo=actual.estado,
            detalle=f"Solicitud cancelada. Motivo: {motivo}",
        )

        transaction.on_commit(lambda: notificar_tarea(actual))

    return actual
