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
    """Registra la solicitud de reapertura del cliente (pendiente de aprobación)."""
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

        actual.estado = Tarea.Estado.REAPERTURA_PENDIENTE
        actual.motivo_reapertura = motivo
        actual.motivo_rechazo_reapertura = ""
        actual.fecha_solicitud_reapertura = ahora
        actual.save(
            update_fields=[
                "estado",
                "motivo_reapertura",
                "motivo_rechazo_reapertura",
                "fecha_solicitud_reapertura",
            ]
        )

        registrar_log(
            tarea=actual,
            usuario=usuario,
            tipo_evento=TareaLog.TipoEvento.SOLICITUD_REAPERTURA,
            estado_anterior=estado_anterior,
            estado_nuevo=actual.estado,
            detalle=(
                f"El cliente solicitó reabrir la solicitud. Motivo: {motivo}. "
                "Queda pendiente de aprobación del equipo."
            ),
        )

    transaction.on_commit(lambda: notificar_tarea(actual))
    return actual


def _miembros_asignables(equipo):
    from usuarios.models import EquipoMiembro

    ids = set(
        equipo.miembros.filter(
            estado=EquipoMiembro.EstadoMiembro.ACTIVO,
        ).values_list("usuario_id", flat=True)
    )
    if equipo.lider_id:
        ids.add(equipo.lider_id)
    return ids


def aprobar_reapertura(
    tarea: Tarea,
    usuario,
    plazo_dias,
    subtareas_nuevas=None,
    subtareas_reactivar=None,
) -> Tarea:
    try:
        plazo_dias = int(plazo_dias)
    except (TypeError, ValueError):
        raise ConfirmacionInvalida("El plazo en días es obligatorio.")

    if plazo_dias < 1:
        raise ConfirmacionInvalida("El plazo debe ser de al menos 1 día.")

    subtareas_nuevas = subtareas_nuevas or []
    ids_reactivar = []
    for valor in subtareas_reactivar or []:
        try:
            ids_reactivar.append(int(valor))
        except (TypeError, ValueError):
            raise ConfirmacionInvalida("Subtarea a reactivar inválida.")

    with transaction.atomic():
        actual = Tarea.objects.select_for_update().get(pk=tarea.pk)

        if actual.estado != Tarea.Estado.REAPERTURA_PENDIENTE:
            raise ConfirmacionInvalida(
                "La solicitud no tiene una reapertura pendiente."
            )

        equipo = actual.equipo
        miembros_ids = _miembros_asignables(equipo)
        creadas = []

        for item in subtareas_nuevas:
            descripcion = (item.get("descripcion") or "").strip()
            asignado_id = item.get("asignado")
            peso = item.get("peso") or 1

            if not descripcion or not asignado_id:
                continue

            try:
                asignado_id = int(asignado_id)
                peso = max(1, int(peso))
            except (TypeError, ValueError):
                raise ConfirmacionInvalida("Datos de subtarea inválidos.")

            if asignado_id not in miembros_ids:
                raise ConfirmacionInvalida(
                    "El usuario asignado no pertenece al equipo."
                )

            creadas.append(
                Subtarea.objects.create(
                    tarea=actual,
                    descripcion=descripcion,
                    asignado_id=asignado_id,
                    peso=peso,
                )
            )

        reactivadas = []
        if ids_reactivar:
            anteriores = Subtarea.objects.select_for_update().filter(
                tarea=actual,
                id__in=ids_reactivar,
            )
            ahora_reactivacion = _ahora()
            for subtarea in anteriores:
                subtarea.activo = True
                subtarea.fecha_inactivacion = None
                subtarea.inactivada_por = None
                subtarea.estado = Subtarea.Estado.EN_DESARROLLO
                subtarea.fecha_inicio = ahora_reactivacion
                subtarea.fecha_fin = None
                subtarea.motivo_standby = ""
                subtarea.fecha_standby = None
                subtarea.fecha_fin_standby = None
                subtarea.standby_por = None
                subtarea.save(
                    update_fields=[
                        "activo",
                        "fecha_inactivacion",
                        "inactivada_por",
                        "estado",
                        "fecha_inicio",
                        "fecha_fin",
                        "motivo_standby",
                        "fecha_standby",
                        "fecha_fin_standby",
                        "standby_por",
                    ]
                )
                reactivadas.append(subtarea)

        if not creadas and not reactivadas:
            raise ConfirmacionInvalida(
                "Debes agregar una subtarea nueva o reactivar una anterior."
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
        actual.plazo_reapertura_dias = plazo_dias
        actual.motivo_rechazo_reapertura = ""
        actual.fecha_entrega_aproximada = sumar_dias_habiles(ahora, plazo_dias)
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
                "plazo_reapertura_dias",
                "motivo_rechazo_reapertura",
                "fecha_entrega_aproximada",
            ]
        )

        _recalcular_progreso(actual)

        registrar_log(
            tarea=actual,
            usuario=usuario,
            tipo_evento=TareaLog.TipoEvento.REAPERTURA,
            estado_anterior=estado_anterior,
            estado_nuevo=actual.estado,
            detalle=(
                "El equipo aprobó la reapertura. "
                f"Plazo: {plazo_dias} día(s) hábil(es). "
                f"Nuevas subtareas: {len(creadas)}; "
                f"reactivadas: {len(reactivadas)}. "
                f"Reapertura {actual.reaperturas_cliente} de "
                f"{MAX_REAPERTURAS_CLIENTE}."
            ),
        )

    transaction.on_commit(lambda: notificar_tarea(actual))
    return actual


def rechazar_reapertura(tarea: Tarea, usuario, motivo: str) -> Tarea:
    motivo = (motivo or "").strip()

    if not motivo:
        raise ConfirmacionInvalida("El motivo de rechazo es obligatorio.")

    with transaction.atomic():
        actual = Tarea.objects.select_for_update().get(pk=tarea.pk)

        if actual.estado != Tarea.Estado.REAPERTURA_PENDIENTE:
            raise ConfirmacionInvalida(
                "La solicitud no tiene una reapertura pendiente."
            )

        estado_anterior = actual.estado
        actual.estado = Tarea.Estado.SOLUCIONADO
        actual.confirmacion_cliente = Tarea.ConfirmacionCliente.PENDIENTE
        actual.motivo_rechazo_reapertura = motivo
        actual.plazo_reapertura_dias = None
        actual.save(
            update_fields=[
                "estado",
                "confirmacion_cliente",
                "motivo_rechazo_reapertura",
                "plazo_reapertura_dias",
            ]
        )

        registrar_log(
            tarea=actual,
            usuario=usuario,
            tipo_evento=TareaLog.TipoEvento.REAPERTURA_RECHAZADA,
            estado_anterior=estado_anterior,
            estado_nuevo=actual.estado,
            detalle=f"El equipo rechazó la reapertura. Motivo: {motivo}",
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
