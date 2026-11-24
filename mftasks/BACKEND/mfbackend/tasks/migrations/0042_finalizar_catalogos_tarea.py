import django.db.models.deletion
import tasks.models
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tasks", "0041_copiar_catalogos_tarea"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="tarea",
            name="tipo_solicitud",
        ),
        migrations.RemoveField(
            model_name="tarea",
            name="prioridad",
        ),
        migrations.RenameField(
            model_name="tarea",
            old_name="tipo_solicitud_ref",
            new_name="tipo_solicitud",
        ),
        migrations.RenameField(
            model_name="tarea",
            old_name="prioridad_ref",
            new_name="prioridad",
        ),
        migrations.AlterField(
            model_name="tarea",
            name="tipo_solicitud",
            field=models.ForeignKey(
                default=tasks.models.default_tipo_solicitud,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="tareas",
                to="tasks.tiposolicitud",
                verbose_name="Tipo de solicitud",
            ),
        ),
        migrations.AlterField(
            model_name="tarea",
            name="prioridad",
            field=models.ForeignKey(
                default=tasks.models.default_prioridad,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="tareas",
                to="tasks.prioridad",
            ),
        ),
    ]
