from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("tasks", "0028_confirmacion_cliente"),
    ]

    operations = [
        migrations.AddField(
            model_name="archivotarea",
            name="informacion_log",
            field=models.ForeignKey(
                blank=True,
                help_text=(
                    "Entrada de información adicional del cliente a la que "
                    "pertenece el archivo."
                ),
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="archivos_informacion",
                to="tasks.tarealog",
            ),
        ),
    ]
