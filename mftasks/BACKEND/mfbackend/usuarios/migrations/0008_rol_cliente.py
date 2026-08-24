from django.db import migrations


ROLES_CLIENTE = [
    ("CLIENTE", "Crea solicitudes y ve el avance de sus tareas"),
]


def crear_rol_cliente(apps, schema_editor):
    Rol = apps.get_model("usuarios", "Rol")
    for nombre, descripcion in ROLES_CLIENTE:
        Rol.objects.get_or_create(
            nombre=nombre,
            defaults={"descripcion": descripcion},
        )


class Migration(migrations.Migration):

    dependencies = [
        ("usuarios", "0007_rol_asistente"),
    ]

    operations = [
        migrations.RunPython(crear_rol_cliente, migrations.RunPython.noop),
    ]
