from django.db import IntegrityError, OperationalError, transaction
from django.db.models import F
from django.utils import timezone


MAX_INTENTOS = 10


def _fecha_local(valor=None):
    if valor is None:
        valor = timezone.localtime(timezone.now())
    else:
        if timezone.is_naive(valor):
            valor = timezone.make_aware(valor, timezone.get_current_timezone())
        valor = timezone.localtime(valor)
    return valor.date()


def _prefijo(fecha):
    return fecha.strftime("%Y%m%d")


def _max_secuencia_ticket(fecha):
    from ..models import Tarea

    prefix = _prefijo(fecha)
    max_ticket = (
        Tarea.objects.filter(ticket__startswith=prefix)
        .order_by("-ticket")
        .values_list("ticket", flat=True)
        .first()
    )
    if max_ticket:
        try:
            return int(max_ticket[len(prefix):])
        except (TypeError, ValueError):
            pass
    return Tarea.objects.filter(ticket__startswith=prefix).count()


def _siguiente_secuencia_ticket(fecha):
    from ..models import SecuenciaTicket, Tarea

    prefix = _prefijo(fecha)

    for _ in range(MAX_INTENTOS):
        try:
            with transaction.atomic():
                secuencia, _ = SecuenciaTicket.objects.get_or_create(
                    fecha=fecha,
                    defaults={"ultimo": _max_secuencia_ticket(fecha)},
                )
                secuencia = SecuenciaTicket.objects.select_for_update().get(
                    pk=secuencia.pk
                )
                SecuenciaTicket.objects.filter(pk=secuencia.pk).update(
                    ultimo=F("ultimo") + 1
                )
                secuencia.refresh_from_db(fields=["ultimo"])
                candidate = f"{prefix}{secuencia.ultimo:05d}"
                if not Tarea.objects.filter(ticket=candidate).exists():
                    return candidate
        except (IntegrityError, OperationalError):
            continue

    raise RuntimeError("No se pudo generar un ticket único.")


def asignar_ticket_tarea(tarea):
    if getattr(tarea, "ticket", None):
        return tarea.ticket

    fecha = _fecha_local(getattr(tarea, "fecha_creacion", None))
    tarea.ticket = _siguiente_secuencia_ticket(fecha)
    return tarea.ticket


def _max_secuencia_codigo(tarea_id, prefix, excluir_pk=None):
    from ..models import Subtarea

    qs = Subtarea.objects.filter(tarea_id=tarea_id)
    if excluir_pk:
        qs = qs.exclude(pk=excluir_pk)

    max_codigo = (
        qs.filter(codigo__startswith=prefix)
        .order_by("-codigo")
        .values_list("codigo", flat=True)
        .first()
    )
    if max_codigo and "-" in max_codigo:
        try:
            return int(max_codigo.rsplit("-", 1)[1])
        except (TypeError, ValueError):
            pass
    return qs.count()


def asignar_codigo_subtarea(subtarea):
    if getattr(subtarea, "codigo", None):
        return subtarea.codigo

    from ..models import Subtarea, Tarea

    tarea_id = getattr(subtarea, "tarea_id", None)
    if not tarea_id:
        return None

    for _ in range(MAX_INTENTOS):
        try:
            with transaction.atomic():
                tarea = Tarea.objects.select_for_update().get(pk=tarea_id)
                if not tarea.ticket:
                    tarea.ticket = _siguiente_secuencia_ticket(
                        _fecha_local(tarea.fecha_creacion)
                    )
                    tarea.save(update_fields=["ticket"])

                prefix = f"{tarea.ticket}-"
                seq = _max_secuencia_codigo(
                    tarea_id, prefix, excluir_pk=getattr(subtarea, "pk", None)
                ) + 1

                for _ in range(MAX_INTENTOS):
                    candidate = f"{tarea.ticket}-{seq:03d}"
                    if not Subtarea.objects.filter(codigo=candidate).exists():
                        subtarea.codigo = candidate
                        return candidate
                    seq += 1
        except (IntegrityError, OperationalError):
            continue

    raise RuntimeError("No se pudo generar un código de subtarea único.")
