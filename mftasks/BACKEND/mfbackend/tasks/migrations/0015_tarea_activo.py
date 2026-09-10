# Generated manual 2026-09-10 for admin solicitudes inactivar

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('tasks', '0014_rename_tasks_subta_tarea_i_57a7f8_idx_tasks_subta_tarea_i_a021cf_idx_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='tarea',
            name='activo',
            field=models.BooleanField(default=True, db_index=True),
        ),
        migrations.AddField(
            model_name='tarea',
            name='fecha_inactivacion',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='tarea',
            name='inactivada_por',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='tareas_inactivadas', to='usuarios.user'),
        ),
        migrations.AddIndex(
            model_name='tarea',
            index=models.Index(fields=['activo'], name='tasks_tarea_activo_idx'),
        ),
    ]
