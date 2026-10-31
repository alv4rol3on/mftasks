from django.db import transaction
from django.utils import timezone

from ..models import Subtarea, Tarea, TareaLog
from .logs import registrar_log
from .notificaciones import notificar_tarea
from .tiempo_laboral import sumar_dias_habiles


PLAZO_CONFIRMACION_DIAS_HABILES = 5
MAX_REAPERTURAS_CLIENTE = 2


class ConfirmacionInvalida(Exception):
    pass


def _ahora():
    return timezone.localtime(timezone.now())


def programar_confirmacion(tarea: Tarea) -> Tarea:
    """Marca la solicitud como solucionada pendiente de confirmación del cliente."""
    ahora = _ahora()
    tarea.confirmacion_cliente = Tarea.ConfirmacionCliente.PENDIENTE
    tarea.fecha_limite_confirmacion = sumar_dias_habiles(
        tarea.fecha_solucion or ahora,
        PLAZO_CONFIRMACION_DIAS_HABILES,
    )
    tarea.fecha_confirmacion_cliente = None
    tarea.save(
        update_fields=[
            "confirmacion_cliente",
            "fecha_limite_confirmacion",
            "fecha_confirmacion_cliente",
        ]
    )
    return tarea


def puede_confirmar_solucion(tarea: Tarea, usuario) -> bool:
    if tarea is None or usuario is None or not getattr(usuario, "is_authenticated", False):
        return False
    if tarea.solicitante_id != usuario.id:
        return False
    if tarea.estado != Tarea.Estado.SOLUCIONADO:
        return False
    if tarea.confirmacion_cliente != Tarea.ConfirmacionCliente.PENDIENTE:
        return False
    return bool(
        tarea.fecha_limite_confirmacion
        and timezone.now() <= tarea.fecha_limite_confirmacion
    )


def puede_reabrir_solucion(tarea: Tarea, usuario) -> bool:
    if not puede_confirmar_solucion(tarea, usuario):
        return False
    return tarea.reaperturas_cliente < MAX_REAPERTURAS_CLIENTE


def confirmar_solucion(tarea: Tarea, usuario) -> Tarea:
    with transaction.atomic():
        actual = Tarea.objects.select_for_update().get(pk=tarea.pk)
        if not puede_confirmar_solucion(actual, usuario):
            raise ConfirmacionInvalida(
                "La solicitud no está pendiente de confirmación o el plazo venció."
            )

        actual.confirmacion_cliente = Tarea.ConfirmacionCliente.CONFIRMADA
        actual.fecha_confirmacion_cliente = _ahora()
        actual.save(
            update_fields=[
                "confirmacion_cliente",
                "fecha_confirmacion_cliente",
            ]
        )

        registrar_log(
            tarea=actual,
            usuario=usuario,
            tipo_evento=TareaLog.TipoEvento.CONFIRMACION_CLIENTE,
            estado_anterior=actual.estado,
            estado_nuevo=actual.estado,
            detalle="El cliente confirmó que la solución fue satisfactoria.",
        )

    transaction.on_commit(lambda: notificar_tarea(actual))
    return actual


def reabrir_tarea(tarea: Tarea, usuario, motivo: str) -> Tarea:
    motivo = (motivo or "").strip()

    if not motivo:
        raise ConfirmacionInvalida("El motivo de reapertura es obligatorio.")

    with transaction.atomic():
        actual = Tarea.objects.select_for_update().get(pk=tarea.pk)

        if not puede_reabrir_solucion(actual, usuario):
            if actual.reaperturas_cliente >= MAX_REAPERTURAS_CLIENTE:
                raise ConfirmacionInvalida(
                    "La solicitud alcanzó el máximo de reaperturas permitidas."
                )
            raise ConfirmacionInvalida(
                "La solicitud no está pendiente de confirmación o el plazo venció."
            )

        estado_anterior = actual.estado
        ahora = _ahora()

        actual.estado = Tarea.Estado.EN_DESARROLLO
        actual.fecha_solucion = None
        actual.activo = True
        actual.confirmacion_cliente = Tarea.ConfirmacionCliente.REABIERTA
        actual.fecha_confirmacion_cliente = None
        actual.fecha_limite_confirmacion = None
        actual.reaperturas_cliente += 1
        actual.fecha_ultima_reapertura = ahora
        actual.motivo_reapertura = motivo
        actual.save(
            update_fields=[
                "estado",
                "fecha_solucion",
                "activo",
                "confirmacion_cliente",
                "fecha_confirmacion_cliente",
                "fecha_limite_confirmacion",
                "reaperturas_cliente",
                "fecha_ultima_reapertura",
                "motivo_reapertura",
            ]
        )

        Subtarea.objects.create(
            tarea=actual,
            descripcion=f"Reapertura: {motivo}",
            asignado=actual.equipo.lider,
            peso=1,
        )
        _recalcular_progreso(actual)

        registrar_log(
            tarea=actual,
            usuario=usuario,
            tipo_evento=TareaLog.TipoEvento.REAPERTURA,
            estado_anterior=estado_anterior,
            estado_nuevo=actual.estado,
            detalle=(
                f"El cliente reabrió la solicitud. Motivo: {motivo}. "
                f"Reapertura {actual.reaperturas_cliente} de "
                f"{MAX_REAPERTURAS_CLIENTE}."
            ),
        )

    transaction.on_commit(lambda: notificar_tarea(actual))
    return actual


def confirmar_automaticamente(tarea: Tarea) -> Tarea:
    with transaction.atomic():
        actual = Tarea.objects.select_for_update().get(pk=tarea.pk)

        if actual.estado != Tarea.Estado.SOLUCIONADO:
            return actual
        if actual.confirmacion_cliente != Tarea.ConfirmacionCliente.PENDIENTE:
            return actual
        if not actual.fecha_limite_confirmacion:
            return actual
        if timezone.now() <= actual.fecha_limite_confirmacion:
            return actual

        actual.confirmacion_cliente = Tarea.ConfirmacionCliente.CONFIRMADA
        actual.fecha_confirmacion_cliente = _ahora()
        actual.save(
            update_fields=[
                "confirmacion_cliente",
                "fecha_confirmacion_cliente",
            ]
        )

        registrar_log(
            tarea=actual,
            usuario=None,
            tipo_evento=TareaLog.TipoEvento.CONFIRMACION_AUTOMATICA,
            estado_anterior=actual.estado,
            estado_nuevo=actual.estado,
            detalle=(
                "La solución se confirmó automáticamente al vencer el plazo "
                "de confirmación del cliente."
            ),
        )

    transaction.on_commit(lambda: notificar_tarea(actual))
    return actual


def _recalcular_progreso(tarea: Tarea) -> None:
    subtareas = list(Subtarea.objects.filter(tarea=tarea, activo=True))
    total_peso = sum(s.peso for s in subtareas)
    peso_solucionado = sum(
        s.peso for s in subtareas if s.estado == Subtarea.Estado.SOLUCIONADO
    )
    tarea.progreso = (
        round((peso_solucionado / total_peso) * 100, 2)
        if total_peso > 0
        else 0
    )
    tarea.save(update_fields=["progreso"])
