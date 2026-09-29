from django.db import migrations, models


CHOICES = [
    ("GERENTE", "Gerente"),
    ("SUBGERENTE", "Subgerente"),
    ("JEFE", "Jefe"),
    ("GTR", "GTR"),
    ("COMPLETADO", "Completado"),
]


def renombrar_pasos(apps, schema_editor):
    Tarea = apps.get_model("tasks", "Tarea")
    AprobacionTarea = apps.get_model("tasks", "AprobacionTarea")

    Tarea.objects.filter(paso_aprobacion="SUPERVISOR").update(paso_aprobacion="JEFE")
    Tarea.objects.filter(paso_aprobacion="LIDER").update(paso_aprobacion="GTR")
    AprobacionTarea.objects.filter(nivel="SUPERVISOR").update(nivel="JEFE")
    AprobacionTarea.objects.filter(nivel="LIDER").update(nivel="GTR")


def revertir_pasos(apps, schema_editor):
    Tarea = apps.get_model("tasks", "Tarea")
    AprobacionTarea = apps.get_model("tasks", "AprobacionTarea")

    Tarea.objects.filter(paso_aprobacion="JEFE").update(paso_aprobacion="SUPERVISOR")
    Tarea.objects.filter(paso_aprobacion="GTR").update(paso_aprobacion="LIDER")
    AprobacionTarea.objects.filter(nivel="JEFE").update(nivel="SUPERVISOR")
    AprobacionTarea.objects.filter(nivel="GTR").update(nivel="LIDER")


class Migration(migrations.Migration):

    dependencies = [
        ("tasks", "0022_alter_aprobaciontarea_nivel_and_more"),
    ]

    operations = [
        migrations.AlterField(
            model_name="tarea",
            name="paso_aprobacion",
            field=models.CharField(
                choices=CHOICES,
                db_index=True,
                default="GERENTE",
                help_text="Nivel de la cadena de aprobación que debe resolver la solicitud.",
                max_length=20,
            ),
        ),
        migrations.AlterField(
            model_name="aprobaciontarea",
            name="nivel",
            field=models.CharField(choices=CHOICES, max_length=20),
        ),
        migrations.RunPython(renombrar_pasos, revertir_pasos),
    ]
