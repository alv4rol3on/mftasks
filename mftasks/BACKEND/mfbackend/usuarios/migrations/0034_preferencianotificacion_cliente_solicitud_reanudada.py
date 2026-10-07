from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("usuarios", "0033_user_descripcion_cargo_user_telefono"),
    ]

    operations = [
        migrations.AddField(
            model_name="preferencianotificacion",
            name="cliente_solicitud_reanudada",
            field=models.BooleanField(default=True),
        ),
    ]
