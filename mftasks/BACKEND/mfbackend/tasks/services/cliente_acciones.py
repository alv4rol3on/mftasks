from django.db import transaction

from ..models import Tarea, TareaLog
from .archivos import guardar_archivos, validar_archivos
from .logs import registrar_log
from .notificaciones import notificar_tarea


ESTADOS_INFORMACION = {
    Tarea.Estado.EN_ESPERA,
    Tarea.Estado.APROBADO,
    Tarea.Estado.EN_DESARROLLO,
    Tarea.Estado.STAND_BY,
}


class InformacionInvalida(Exception):
    pass


def _es_duenio_o_admin(tarea, usuario):
    if not usuario or not getattr(usuario, "is_authenticated", False):
        return False
    if tarea.solicitante_id == usuario.id:
        return True
    from usuarios.permissions import es_administrador

    return es_administrador(usuario)


def puede_cancelar_cliente(tarea, usuario) -> bool:
    return (
        _es_duenio_o_admin(tarea, usuario)
        and bool(tarea.activo)
        and tarea.estado in (Tarea.Estado.EN_ESPERA, Tarea.Estado.APROBADO)
    )


def puede_agregar_informacion(tarea, usuario) -> bool:
    if not _es_duenio_o_admin(tarea, usuario) or not tarea.activo:
        return False
    if tarea.estado in ESTADOS_INFORMACION:
        return True
    if (
        tarea.estado == Tarea.Estado.SOLUCIONADO
        and tarea.confirmacion_cliente == Tarea.ConfirmacionCliente.PENDIENTE
    ):
        return True
    return False


def agregar_informacion(tarea, usuario, detalle, archivos):
    detalle = (detalle or "").strip()
    archivos = list(archivos or [])

    if not detalle and not archivos:
        raise InformacionInvalida(
            "Agrega una nota o al menos un archivo."
        )
    if not puede_agregar_informacion(tarea, usuario):
        raise InformacionInvalida(
            "No puedes agregar información en el estado actual de la solicitud."
        )

    validar_archivos(archivos)

    with transaction.atomic():
        creados = guardar_archivos(tarea, archivos, usuario)
        nombres = ", ".join(archivo.nombre for archivo in creados)
        partes = []
        if detalle:
            partes.append(detalle)
        if nombres:
            partes.append(f"Archivos adjuntos: {nombres}")
        texto = " · ".join(partes)

        log = registrar_log(
            tarea=tarea,
            usuario=usuario,
            tipo_evento=TareaLog.TipoEvento.INFORMACION_ADICIONAL,
            detalle=texto,
        )

    transaction.on_commit(lambda: notificar_tarea(tarea))
    return log, creados
