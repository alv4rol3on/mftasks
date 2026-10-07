import django.core.validators
from django.db import migrations, models


# Colores con los que se venían pintando las tarjetas de equipo según el tipo.
COLORES_POR_ROL = {
    "GERENTE": "#6d28d9",
    "SUBGERENTE": "#1d4ed8",
    "JEFE": "#0f766e",
    "GTR": "#b45309",
}


def sembrar_colores(apps, schema_editor):
    Rol = apps.get_model("usuarios", "Rol")
    for nombre, color in COLORES_POR_ROL.items():
        Rol.objects.filter(nombre__iexact=nombre, color="").update(color=color)


def revertir_colores(apps, schema_editor):
    Rol = apps.get_model("usuarios", "Rol")
    for nombre, color in COLORES_POR_ROL.items():
        Rol.objects.filter(nombre__iexact=nombre, color=color).update(color="")


class Migration(migrations.Migration):

    dependencies = [
        ("usuarios", "0034_preferencianotificacion_cliente_solicitud_reanudada"),
    ]

    operations = [
        migrations.AddField(
            model_name="rol",
            name="color",
            field=models.CharField(
                blank=True,
                default="",
                max_length=7,
                validators=[
                    django.core.validators.RegexValidator(
                        "^#(?:[0-9a-fA-F]{6})$",
                        "Use un color hexadecimal en formato #RRGGBB.",
                    )
                ],
                help_text=(
                    "Color hexadecimal (#RRGGBB) que heredan los equipos de este "
                    "rol para la barra de su tarjeta. Vacío = neutro."
                ),
            ),
        ),
        migrations.RunPython(sembrar_colores, revertir_colores),
    ]
