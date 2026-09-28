from django.db import migrations


def reparar_tareas_inactivas(apps, schema_editor):
    """Reactiva solicitudes que nacieron inactivas por el bug de `activo` escribible.

    Solo toca tareas que nunca fueron inactivadas explícitamente
    (fecha_inactivacion nula).
    """
    Tarea = apps.get_model("tasks", "Tarea")
    Tarea.objects.filter(activo=False, fecha_inactivacion__isnull=True).update(activo=True)


def revertir(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("tasks", "0019_tarea_paso_aprobacion_aprobaciontarea"),
    ]

    operations = [
        migrations.RunPython(reparar_tareas_inactivas, revertir),
    ]
