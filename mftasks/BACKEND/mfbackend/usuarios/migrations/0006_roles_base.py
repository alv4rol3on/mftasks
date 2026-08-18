from django.db import migrations


ROLES_BASE = [
    ("Administrador", "Administra todo el sistema"),
    ("ASIGNADOR", "Aprueba, rechaza y asigna tareas de su equipo"),
]


def crear_roles_base(apps, schema_editor):
    Rol = apps.get_model("usuarios", "Rol")

    for nombre, descripcion in ROLES_BASE:
        Rol.objects.get_or_create(
            nombre=nombre,
            defaults={"descripcion": descripcion},
        )


class Migration(migrations.Migration):

    dependencies = [
        ("usuarios", "0005_alter_user_managers"),
    ]

    operations = [
        migrations.RunPython(crear_roles_base, migrations.RunPython.noop),
    ]
