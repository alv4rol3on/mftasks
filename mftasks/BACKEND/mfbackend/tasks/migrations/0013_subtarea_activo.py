# Generated manual 2026-09-10 for Asignaciones tab (activo soft)

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('tasks', '0012_incluye_sabado'),
    ]

    operations = [
        migrations.AddField(
            model_name='subtarea',
            name='activo',
            field=models.BooleanField(default=True, db_index=True),
        ),
        migrations.AddField(
            model_name='subtarea',
            name='fecha_inactivacion',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='subtarea',
            name='inactivada_por',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='subtareas_inactivadas', to='usuarios.user'),
        ),
        migrations.AddIndex(
            model_name='subtarea',
            index=models.Index(fields=['tarea', 'activo'], name='tasks_subta_tarea_i_57a7f8_idx'),
        ),
        migrations.AddIndex(
            model_name='subtarea',
            index=models.Index(fields=['activo'], name='tasks_subta_activo_2a14d1_idx'),
        ),
    ]
