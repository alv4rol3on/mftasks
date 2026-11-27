from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("usuarios", "0043_remove_user_puede_crear_solicitudes"),
    ]

    operations = [
        migrations.AddField(
            model_name="equipo",
            name="alcance_integrantes",
            field=models.CharField(
                choices=[
                    ("DIRECTO", "Solo nivel inferior directo"),
                    ("CUALQUIER", "Cualquier nivel inferior"),
                ],
                default="DIRECTO",
                help_text=(
                    "Define si el equipo admite solo integrantes de los niveles "
                    "inferiores directos del líder o de cualquier nivel inferior."
                ),
                max_length=20,
            ),
        ),
    ]
