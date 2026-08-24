from django.db import migrations


ROLES_ASISTENTE = [
    ("ASISTENTE", "Puede ver y completar sus subtareas asignadas"),
]


def crear_rol_asistente(apps, schema_editor):
    Rol = apps.get_model("usuarios", "Rol")
    for nombre, descripcion in ROLES_ASISTENTE:
        Rol.objects.get_or_create(
            nombre=nombre,
            defaults={"descripcion": descripcion},
        )


class Migration(migrations.Migration):

    dependencies = [
        ("usuarios", "0006_roles_base"),
    ]

    operations = [
        migrations.RunPython(crear_rol_asistente, migrations.RunPython.noop),
    ]
