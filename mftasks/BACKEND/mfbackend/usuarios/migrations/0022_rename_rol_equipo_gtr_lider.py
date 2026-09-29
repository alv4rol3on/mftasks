from django.db import migrations, models
from django.db.models import Q


def gtr_a_lider(apps, schema_editor):
    EquipoMiembro = apps.get_model("usuarios", "EquipoMiembro")
    EquipoMiembro.objects.filter(rol_en_equipo="GTR").update(rol_en_equipo="LIDER")


def lider_a_gtr(apps, schema_editor):
    EquipoMiembro = apps.get_model("usuarios", "EquipoMiembro")
    EquipoMiembro.objects.filter(rol_en_equipo="LIDER").update(rol_en_equipo="GTR")


class Migration(migrations.Migration):

    dependencies = [
        ("usuarios", "0021_jerarquia_jefe_gtr_tipo_equipo"),
    ]

    operations = [
        migrations.AlterField(
            model_name="equipomiembro",
            name="rol_en_equipo",
            field=models.CharField(
                choices=[
                    ("LIDER", "Líder"),
                    ("MIEMBRO", "Miembro"),
                    ("SUB_LIDER", "Sub-líder"),
                ],
                default="MIEMBRO",
                max_length=20,
            ),
        ),
        migrations.RemoveConstraint(
            model_name="equipomiembro",
            name="unico_lider_por_equipo",
        ),
        migrations.AddConstraint(
            model_name="equipomiembro",
            constraint=models.UniqueConstraint(
                condition=Q(("rol_en_equipo", "LIDER")),
                fields=("equipo",),
                name="unico_lider_por_equipo",
            ),
        ),
        migrations.RunPython(gtr_a_lider, lider_a_gtr),
    ]
