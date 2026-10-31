from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("tasks", "0030_prioridad_severidad_impacto"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="tarea",
            name="severidad",
        ),
        migrations.RemoveField(
            model_name="tarea",
            name="impacto",
        ),
    ]
