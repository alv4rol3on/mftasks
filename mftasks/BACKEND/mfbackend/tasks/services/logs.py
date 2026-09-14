from ..models import TareaLog


def registrar_log(
    *,
    tarea,
    usuario,
    tipo_evento,
    subtarea=None,
    estado_anterior=None,
    estado_nuevo=None,
    detalle="",
    standby_excluido=None,
):
    kwargs = {}
    if standby_excluido is not None:
        kwargs["standby_excluido"] = standby_excluido
    return TareaLog.objects.create(
        tarea=tarea,
        subtarea=subtarea,
        usuario=usuario,
        tipo_evento=tipo_evento,
        estado_anterior=estado_anterior,
        estado_nuevo=estado_nuevo,
        detalle=detalle,
        **kwargs,
    )