from django.db import migrations, models


PASO_CHOICES = [
    ("GERENTE", "Gerente"),
    ("SUBGERENTE", "Subgerente"),
    ("COORDINADOR", "Coordinador"),
    ("LIDER", "Líder"),
    ("COMPLETADO", "Completado"),
]


def jefe_a_lider(apps, schema_editor):
    Tarea = apps.get_model("tasks", "Tarea")
    AprobacionTarea = apps.get_model("tasks", "AprobacionTarea")
    Tarea.objects.filter(paso_aprobacion="JEFE").update(paso_aprobacion="LIDER")
    AprobacionTarea.objects.filter(nivel="JEFE").update(nivel="LIDER")


def lider_a_jefe(apps, schema_editor):
    Tarea = apps.get_model("tasks", "Tarea")
    AprobacionTarea = apps.get_model("tasks", "AprobacionTarea")
    Tarea.objects.filter(paso_aprobacion="LIDER").update(paso_aprobacion="JEFE")
    AprobacionTarea.objects.filter(nivel="LIDER").update(nivel="JEFE")


class Migration(migrations.Migration):

    dependencies = [
        ("tasks", "0020_reparar_tareas_activas"),
    ]

    operations = [
        migrations.AlterField(
            model_name="tarea",
            name="paso_aprobacion",
            field=models.CharField(
                choices=PASO_CHOICES,
                default="GERENTE",
                db_index=True,
                help_text=(
                    "Nivel de la cadena de aprobación que debe resolver la solicitud."
                ),
                max_length=20,
            ),
        ),
        migrations.AlterField(
            model_name="aprobaciontarea",
            name="nivel",
            field=models.CharField(choices=PASO_CHOICES, max_length=20),
        ),
        migrations.RunPython(jefe_a_lider, lider_a_jefe),
    ]
