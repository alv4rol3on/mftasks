from django.db import migrations


def copiar_alcance_a_equipos(apps, schema_editor):
    ConfiguracionAprobacion = apps.get_model("tasks", "ConfiguracionAprobacion")
    Equipo = apps.get_model("usuarios", "Equipo")

    config = ConfiguracionAprobacion.objects.filter(pk=1).first()
    alcance = config.alcance_integrantes if config is not None else "DIRECTO"

    Equipo.objects.update(alcance_integrantes=alcance)


class Migration(migrations.Migration):

    dependencies = [
        ("tasks", "0043_configuracionaprobacion_alcance_integrantes"),
        ("usuarios", "0044_equipo_alcance_integrantes"),
    ]

    operations = [
        migrations.RunPython(
            copiar_alcance_a_equipos,
            migrations.RunPython.noop,
        ),
        migrations.RemoveField(
            model_name="configuracionaprobacion",
            name="alcance_integrantes",
        ),
    ]
