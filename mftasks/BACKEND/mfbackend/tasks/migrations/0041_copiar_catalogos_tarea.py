from django.db import migrations


def copiar_a_catalogos(apps, schema_editor):
    Tarea = apps.get_model("tasks", "Tarea")
    TipoSolicitud = apps.get_model("tasks", "TipoSolicitud")
    Prioridad = apps.get_model("tasks", "Prioridad")

    tipos = {obj.codigo: obj.pk for obj in TipoSolicitud.objects.all()}
    prioridades = {obj.codigo: obj.pk for obj in Prioridad.objects.all()}

    tipo_default = tipos.get("OTROS")
    prioridad_default = prioridades.get("MEDIA")

    for tarea in Tarea.objects.all().iterator():
        Tarea.objects.filter(pk=tarea.pk).update(
            tipo_solicitud_ref_id=tipos.get(
                tarea.tipo_solicitud, tipo_default
            ),
            prioridad_ref_id=prioridades.get(
                tarea.prioridad, prioridad_default
            ),
        )


def revertir(apps, schema_editor):
    Tarea = apps.get_model("tasks", "Tarea")
    Tarea.objects.update(
        tipo_solicitud_ref=None,
        prioridad_ref=None,
    )


class Migration(migrations.Migration):

    dependencies = [
        ("tasks", "0040_catalogos_tipo_solicitud_prioridad"),
    ]

    operations = [
        migrations.RunPython(copiar_a_catalogos, revertir),
    ]
