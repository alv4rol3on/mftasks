from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


CADENA_APROBACION = ["GERENTE", "SUBGERENTE", "COORDINADOR", "JEFE"]

PASO_CHOICES = [(n, n.capitalize()) for n in CADENA_APROBACION] + [
    ("COMPLETADO", "Completado"),
]


def inicializar_pasos(apps, schema_editor):
    Tarea = apps.get_model("tasks", "Tarea")
    Tarea.objects.filter(estado="EN_ESPERA").update(paso_aprobacion="GERENTE")
    Tarea.objects.exclude(estado="EN_ESPERA").update(paso_aprobacion="COMPLETADO")


def revertir_pasos(apps, schema_editor):
    Tarea = apps.get_model("tasks", "Tarea")
    Tarea.objects.update(paso_aprobacion="GERENTE")


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("tasks", "0018_tarealog_standby_excluido"),
        ("usuarios", "0019_roles_jerarquia"),
    ]

    operations = [
        migrations.AddField(
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
        migrations.CreateModel(
            name="AprobacionTarea",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "nivel",
                    models.CharField(choices=PASO_CHOICES, max_length=20),
                ),
                (
                    "accion",
                    models.CharField(
                        choices=[
                            ("APROBADO", "Aprobado"),
                            ("RECHAZADO", "Rechazado"),
                        ],
                        max_length=20,
                    ),
                ),
                ("motivo", models.TextField(blank=True)),
                ("fecha", models.DateTimeField(auto_now_add=True, db_index=True)),
                (
                    "tarea",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="aprobaciones",
                        to="tasks.tarea",
                    ),
                ),
                (
                    "usuario",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="aprobaciones_realizadas",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["fecha", "id"],
                "indexes": [
                    models.Index(
                        fields=["tarea", "fecha"],
                        name="tasks_aprob_tarea_fecha_idx",
                    ),
                    models.Index(
                        fields=["nivel"],
                        name="tasks_aprob_nivel_idx",
                    ),
                ],
            },
        ),
        migrations.AddIndex(
            model_name="tarea",
            index=models.Index(
                fields=["paso_aprobacion", "estado"],
                name="tasks_tarea_paso_estado_idx",
            ),
        ),
        migrations.RunPython(inicializar_pasos, revertir_pasos),
    ]
