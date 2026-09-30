from django.db import migrations


# Roles de aprobador permitidos por tipo de equipo (copia local para que la
# migración sea autocontenida). Debe coincidir con usuarios/jerarquia.py.
ROLES_APROBADOR_POR_TIPO = {
    "GERENTE": (),
    "SUBGERENTE": ("GERENTE",),
    "JEFE": ("GERENTE", "SUBGERENTE"),
    "GTR": ("GERENTE", "SUBGERENTE", "JEFE"),
}


def limpiar_aprobadores_invalidos(apps, schema_editor):
    EquipoAprobador = apps.get_model("usuarios", "EquipoAprobador")
    for aprobador in EquipoAprobador.objects.select_related("equipo").iterator():
        permitidos = ROLES_APROBADOR_POR_TIPO.get(
            aprobador.equipo.tipo_equipo, ROLES_APROBADOR_POR_TIPO["GTR"]
        )
        if aprobador.rol_aprobador not in permitidos:
            aprobador.delete()


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("usuarios", "0024_equipoaprobador_and_more"),
    ]

    operations = [
        migrations.RunPython(limpiar_aprobadores_invalidos, noop),
    ]
